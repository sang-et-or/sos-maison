import { z } from "zod";
import { sql, getSetting } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { recordUsage } from "@/lib/usage";
import { PLACES_COST_USD, searchGooglePros, TRADE_QUERY } from "@/lib/places/google";

export const runtime = "nodejs";

const Query = z.object({
  metier: z.string().refine((m) => m in TRADE_QUERY, "Métier inconnu."),
  lieu: z.string().trim().min(2).max(80).regex(/^[\p{L}0-9 '’.-]+$/u, "Indiquez une ville ou un code postal."),
});

/** Artisans trouvés sur Google, affichés dans le site (connexion requise pour limiter les abus). */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new HttpError(503, "La recherche Google n'est pas encore activée.", "disabled");

    const url = new URL(req.url);
    const p = Query.safeParse({ metier: url.searchParams.get("metier") ?? "", lieu: url.searchParams.get("lieu") ?? "" });
    if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Recherche invalide.");

    const limit = Number(await getSetting<number>("google_search_daily_limit", 10)) || 10;
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from usage_events
      where user_id = ${user.id} and kind = 'places' and created_at > now() - interval '1 day'`;
    if (n >= limit) throw new HttpError(429, `Vous avez fait ${limit} recherches aujourd'hui. Réessayez demain.`, "limit");

    const results = await searchGooglePros(p.data.metier, p.data.lieu, key);
    await recordUsage({ userId: user.id, kind: "places", provider: "google", costUsd: PLACES_COST_USD });
    return Response.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (!(e instanceof HttpError)) {
      console.error(e);
      return Response.json({ error: "Google ne répond pas pour le moment. Réessayez dans un instant." }, { status: 502 });
    }
    return errorResponse(e);
  }
}
