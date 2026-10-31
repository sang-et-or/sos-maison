import data from "@/content/guides.json";

/** Guides d'entretien illustrés (contenu rédigé à partir de tutoriels publics, sources citées). */
export interface GuideStep {
  t: string;
  x: string;
  astuce?: string;
  img?: string;
}
export interface Guide {
  id: string;
  e: string;
  bg: string;
  ill: string;
  t: string;
  d: string;
  min: number;
  niveau: string;
  cout: string;
  pourquoi: string;
  quand: string;
  secu: string;
  outils: string[];
  s: GuideStep[];
  erreurs: string[];
  pro: string[];
  sources: [string, string][];
}
export type SeasonKey = "automne" | "hiver" | "printemps" | "ete";
export interface Season {
  n: string;
  bg: string;
  items: [string, string, string?][];
}

const BG: Record<string, string> = {
  "var(--peach)": "#ffe9df",
  "var(--red-50)": "#fdecee",
  "var(--sky-50)": "#e4edff",
  "var(--sun-50)": "#fff6d9",
  "var(--lilac-50)": "#eee9ff",
  "var(--mint-50)": "#ddf6f1",
};

export const GUIDES: Guide[] = (data.guides as unknown as Guide[]).map((g) => ({ ...g, bg: BG[g.bg] ?? "#f4f6fb" }));
export const ILLUSTRATIONS: Record<string, string> = data.ill as Record<string, string>;
export const SEASONS = data.seasons as unknown as Record<SeasonKey, Season>;

export function guideById(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}

/** Saison météorologique en France pour une date donnée. */
export function seasonOf(d = new Date()): SeasonKey {
  const m = d.getMonth() + 1;
  if (m >= 9 && m <= 11) return "automne";
  if (m === 12 || m <= 2) return "hiver";
  if (m <= 5) return "printemps";
  return "ete";
}

const KEYWORDS: [RegExp, string][] = [
  [/radiateur|purge|chauffe mal|gargouill/, "radiateur"],
  [/chaudiere|pression|manometre/, "chaudiere"],
  [/detecteur|fumee|daaf|bip/, "daaf"],
  [/robinet exterieur|jardin|arrosage/, "exterieur"],
  [/gouttiere|feuilles/, "gouttieres"],
  [/aerer|humidite|condensation|moisissure/, "aerer"],
  [/gel|geler|tuyau.*froid/, "gel"],
  [/vmc|ventilation|bouche d.?aeration/, "vmc"],
  [/mousseur|calcaire|debit faible|robinet/, "mousseur"],
  [/lave.?vaisselle/, "lv"],
  [/lave.?linge|machine a laver|vidange/, "ll"],
  [/joint|silicone|douche|baignoire/, "joints"],
  [/frigo|refrigerateur|congelateur/, "frigo"],
  [/couper l.?eau|vanne|compteur d.?eau|fuite/, "eau"],
  [/disjonct|tableau electrique|plus de courant|coupure/, "disj"],
  [/evier|bouche|siphon|ecoulement/, "evier"],
  [/porte|frotte|grince|charniere/, "porte"],
];

/** Guide le plus proche d'une description libre (sans IA). */
export function suggestGuide(text: string): Guide | undefined {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [re, id] of KEYWORDS) if (re.test(t)) return guideById(id);
  return undefined;
}
