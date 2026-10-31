/**
 * Fiche de réparation : l'assistant la remplit via un outil structuré,
 * le serveur la valide ici avant de l'afficher (jamais de contenu brut du modèle).
 */
import { stripUnverifiedLinks } from "../search/links";

export interface RepairCard {
  titre: string;
  diagnostic: string;
  securite: string;
  outils: string[];
  etapes: string[];
  duree_minutes?: number;
  cout_min_eur?: number;
  cout_max_eur?: number;
  /** Prix typique d'une intervention d'artisan évitée, pour l'estimation d'économie. */
  economie_estimee_eur?: number;
}

export const CARD_TOOL = {
  name: "fiche_reparation",
  description:
    "Affiche à l'utilisateur une fiche de réparation interactive (étapes à cocher). À utiliser dès que tu proposes une réparation pas à pas, au lieu d'écrire les étapes dans ton message.",
  input_schema: {
    type: "object" as const,
    properties: {
      titre: { type: "string", description: "Titre court de la réparation, ex. « Régler le flotteur »." },
      diagnostic: { type: "string", description: "Cause probable en une phrase simple." },
      securite: { type: "string", description: "Mesure de sécurité à prendre avant de commencer (couper l'eau, débrancher…)." },
      outils: { type: "array", items: { type: "string" }, description: "Outils et pièces nécessaires, un par élément, nommés comme en magasin pour être trouvés facilement (ex. « Bouton de thermostat universel axe 6 mm (environ 8 €) »). Prix approximatif entre parenthèses." },
      etapes: { type: "array", items: { type: "string" }, description: "2 à 10 étapes, une action concrète par étape. Citer une source avec [n] si utile." },
      duree_minutes: { type: "integer", description: "Durée estimée." },
      cout_min_eur: { type: "integer", description: "Coût minimum des pièces en euros (0 si aucune)." },
      cout_max_eur: { type: "integer", description: "Coût maximum des pièces en euros." },
      economie_estimee_eur: { type: "integer", description: "Prix habituel d'un artisan pour cette intervention en France (déplacement compris)." },
    },
    required: ["titre", "diagnostic", "securite", "outils", "etapes"],
  },
};

const clean = (v: unknown, max: number, allowed: string[]): string => {
  if (typeof v !== "string") return "";
  const t = stripUnverifiedLinks(v.replace(/\s+/g, " ").trim(), allowed).text.trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
};

const int = (v: unknown, min: number, max: number): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/** Valide et nettoie la fiche proposée par le modèle. Retourne null si elle est inutilisable. */
export function normalizeCard(input: unknown, allowedUrls: string[] = []): RepairCard | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const list = (v: unknown, maxItems: number, maxLen: number) =>
    Array.isArray(v) ? v.map((x) => clean(x, maxLen, allowedUrls)).filter(Boolean).slice(0, maxItems) : [];

  const card: RepairCard = {
    titre: clean(o.titre, 60, allowedUrls),
    diagnostic: clean(o.diagnostic, 240, allowedUrls),
    securite: clean(o.securite, 240, allowedUrls),
    outils: list(o.outils, 8, 60),
    etapes: list(o.etapes, 10, 260),
  };
  if (!card.titre || !card.diagnostic || card.etapes.length < 2) return null;
  if (!card.securite) card.securite = "Prenez votre temps et arrêtez-vous au moindre doute.";

  const d = int(o.duree_minutes, 1, 600);
  const cmin = int(o.cout_min_eur, 0, 2000);
  const cmax = int(o.cout_max_eur, 0, 2000);
  const eco = int(o.economie_estimee_eur, 0, 2000);
  if (d !== undefined) card.duree_minutes = d;
  if (cmin !== undefined) card.cout_min_eur = cmin;
  if (cmax !== undefined) card.cout_max_eur = Math.max(cmax, cmin ?? 0);
  if (eco !== undefined) card.economie_estimee_eur = eco;
  return card;
}

export function formatDuration(min?: number): string | null {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

export function formatCost(card: Pick<RepairCard, "cout_min_eur" | "cout_max_eur">): string | null {
  const { cout_min_eur: a, cout_max_eur: b } = card;
  if (a === undefined && b === undefined) return null;
  if ((a ?? 0) === 0 && (b ?? 0) === 0) return "0 €";
  if (a === undefined || a === b) return `${b} €`;
  if (b === undefined) return `dès ${a} €`;
  return `${a} à ${b} €`;
}
