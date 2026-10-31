/**
 * Recherche d'artisans via Google Places API (New) — Text Search.
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Coût (grille Google relevée le 31/10/2026) : SKU « Text Search Enterprise »,
 * 1 000 requêtes gratuites par mois puis 35 $ / 1 000. La facturation suit le champ
 * le plus cher du masque : téléphone, note et horaires sont des champs Enterprise.
 *
 * Règles Google : afficher l'attribution « Google », ne pas stocker les résultats
 * (seul l'identifiant de lieu peut être conservé). On ne met donc rien en base.
 */

export const PLACES_COST_USD = 0.035;

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.currentOpeningHours.openNow",
  "places.businessStatus",
].join(",");

/** Métier SOS Maison → mots de recherche et type Google (biais seulement, non strict). */
export const TRADE_QUERY: Record<string, { words: string; type?: string }> = {
  plombier: { words: "plombier", type: "plumber" },
  electricien: { words: "électricien", type: "electrician" },
  chauffagiste: { words: "chauffagiste dépannage chaudière" },
  serrurier: { words: "serrurier", type: "locksmith" },
  electromenager: { words: "réparation électroménager" },
  multiservices: { words: "artisan multiservices petits travaux", type: "general_contractor" },
};

export interface GooglePro {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  rating: number | null;
  ratingCount: number;
  website: string | null;
  mapsUrl: string | null;
  openNow: boolean | null;
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  currentOpeningHours?: { openNow?: boolean };
  businessStatus?: string;
}

const httpsOrNull = (u?: string) => (u && /^https:\/\//.test(u) ? u : null);

/** Nettoie la réponse Google : établissements ouverts uniquement, champs bornés. */
export function normalizePlaces(data: unknown, max = 10): GooglePro[] {
  const places = (data as { places?: RawPlace[] } | null)?.places;
  if (!Array.isArray(places)) return [];
  const out: GooglePro[] = [];
  for (const p of places) {
    const name = p.displayName?.text?.trim();
    if (!p.id || !name) continue;
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
    out.push({
      id: p.id,
      name: name.slice(0, 120),
      address: (p.formattedAddress ?? "").replace(/, France$/, "").slice(0, 200),
      phone: p.nationalPhoneNumber?.slice(0, 30) ?? null,
      rating: typeof p.rating === "number" ? Math.round(p.rating * 10) / 10 : null,
      ratingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : 0,
      website: httpsOrNull(p.websiteUri),
      mapsUrl: httpsOrNull(p.googleMapsUri),
      openNow: typeof p.currentOpeningHours?.openNow === "boolean" ? p.currentOpeningHours.openNow : null,
    });
    if (out.length >= max) break;
  }
  return out;
}

export function buildQuery(trade: string, place: string): { textQuery: string; includedType?: string } {
  const t = TRADE_QUERY[trade] ?? TRADE_QUERY.multiservices;
  return { textQuery: `${t.words} ${place}`.trim().slice(0, 200), includedType: t.type };
}

/** Appel à Google (serveur uniquement : la clé ne quitte jamais le serveur). */
export async function searchGooglePros(trade: string, place: string, apiKey: string): Promise<GooglePro[]> {
  const q = buildQuery(trade, place);
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: q.textQuery,
      languageCode: "fr",
      regionCode: "FR",
      pageSize: 10,
      ...(q.includedType ? { includedType: q.includedType } : {}),
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}`);
  return normalizePlaces(await res.json());
}
