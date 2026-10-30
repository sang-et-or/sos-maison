/**
 * Classification des risques — couche déterministe.
 *
 * Elle tourne AVANT tout appel à l'IA et ne peut jamais être contournée par le
 * modèle : le niveau final est le maximum entre ces règles et le classificateur IA
 * (Haiku), et un dépannage ne redescend jamais de niveau (trigger SQL).
 *
 * Niveaux :
 *  0 sans risque · 1 précautions · 2 limité (vérifications sans démontage)
 *  3 professionnel requis (aucun tutoriel) · 4 urgence (écran d'urgence)
 */

export type RiskLevel = 0 | 1 | 2 | 3 | 4;

export type Hazard =
  | "gas"
  | "fire"
  | "electric_shock"
  | "carbon_monoxide"
  | "flood_electric"
  | "structure"
  | "injury"
  | "gas_appliance"
  | "electrical_panel"
  | "asbestos"
  | "height"
  | "chemical"
  | "mains_wiring"
  | "water"
  | "appliance";

export interface RiskRule {
  hazard: Hazard;
  level: RiskLevel;
  /** Métier à proposer dans l'annuaire. */
  pro?: string;
  patterns: RegExp[];
  /** Si un de ces mots précède le motif (≤ 3 mots), le niveau baisse d'un cran. */
  negatable?: boolean;
}

export interface RiskResult {
  level: RiskLevel;
  hazards: Hazard[];
  pro?: string;
}

/** Minuscules, sans accents, apostrophes et espaces normalisés. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const w = (s: string) => new RegExp(`(^|[^a-z])${s}`, "i");

export const RULES: RiskRule[] = [
  // ---- Niveau 4 : urgence -------------------------------------------------
  {
    hazard: "gas",
    level: 4,
    pro: "chauffagiste",
    negatable: true,
    patterns: [
      w("odeur de gaz"),
      w("(ca|ça|sa) sent (le|du) gaz"),
      w("sens (le|du|une odeur de) gaz"),
      w("fuite de gaz"),
      w("gaz (qui )?fuit"),
      w("odeur d'oeuf pourri"),
    ],
  },
  {
    hazard: "fire",
    level: 4,
    negatable: true,
    patterns: [
      w("(de la |du )?fumee"),
      w("flammes?"),
      w("(prend|a pris|pris|en) feu"),
      w("incendie"),
      w("odeur de (brule|plastique brule|cramee?)"),
      w("ca crame"),
    ],
  },
  {
    hazard: "electric_shock",
    level: 4,
    pro: "electricien",
    negatable: true,
    patterns: [
      w("etincelles?"),
      w("arc electrique"),
      w("electrocut"),
      w("electrise"),
      w("(j'ai|il a|elle a|on a) pris (le|un) (jus|courant|coup de jus)"),
      w("prise (qui )?(fond|a fondu|noircie|brulee|chauffe)"),
      w("ca grésille|ca gresille|gresillement"),
    ],
  },
  {
    hazard: "carbon_monoxide",
    level: 4,
    pro: "chauffagiste",
    patterns: [
      w("monoxyde"),
      w("detecteur (de )?(co|monoxyde)"),
      w("(mal (a la|de) tete|maux de tete|nausees?|vertiges?).{0,60}(chaudiere|chauffe-eau|poele|cheminee)"),
      w("(chaudiere|chauffe-eau|poele|cheminee).{0,60}(mal (a la|de) tete|maux de tete|nausees?|vertiges?)"),
    ],
  },
  {
    hazard: "flood_electric",
    level: 4,
    pro: "electricien",
    patterns: [
      w("eau.{0,40}(prise|tableau electrique|compteur electrique|multiprise)"),
      w("(prise|tableau electrique|multiprise).{0,40}(mouille|inonde|dans l'eau)"),
    ],
  },
  {
    hazard: "structure",
    level: 4,
    patterns: [
      w("plafond.{0,30}(s'effondre|effondre|tombe|s'affaisse|bombe)"),
      w("(mur|plancher|balcon).{0,30}(s'effondre|s'affaisse|bouge|cede)"),
      w("fissure.{0,30}(s'agrandit|s'elargit|grandit)"),
    ],
  },
  {
    hazard: "injury",
    level: 4,
    patterns: [
      w("(je saigne|saigne beaucoup|blesse|blessure grave|inconscient|evanoui|ne respire plus)"),
    ],
  },

  // ---- Niveau 3 : professionnel requis ------------------------------------
  {
    hazard: "gas_appliance",
    level: 3,
    pro: "chauffagiste",
    patterns: [
      w("chaudiere"),
      w("bruleur"),
      w("(chauffe-eau|chauffe eau) (a |au )?gaz"),
      w("gaziniere"),
      w("(raccord|tuyau|flexible|robinet) (de |du )?gaz"),
      w("compteur (de |du )?gaz"),
      w("conduit de (cheminee|fumee)"),
      w("ramonage"),
    ],
  },
  {
    hazard: "electrical_panel",
    level: 3,
    pro: "electricien",
    patterns: [
      w("tableau electrique"),
      w("(fil|cable)s? (denude|a nu)"),
      w("compteur (electrique|linky)"),
      w("(refaire|tirer|ajouter) (une )?ligne electrique"),
      w("disjoncteur (general )?(qui )?(saute|disjoncte) (tout le temps|sans arret|en permanence|souvent)"),
    ],
  },
  {
    hazard: "structure",
    level: 3,
    patterns: [
      w("mur porteur"),
      w("poutre"),
      w("(abattre|casser|ouvrir) (un |le )?mur"),
      w("charpente"),
      w("fissure"),
    ],
  },
  {
    hazard: "asbestos",
    level: 3,
    patterns: [w("amiante"), w("fibro-?ciment")],
  },

  // ---- Niveau 2 : vérifications sans démontage ----------------------------
  {
    hazard: "mains_wiring",
    level: 2,
    pro: "electricien",
    patterns: [
      w("(changer|remplacer|installer|brancher|demonter) (une |la |un |le )?(prise|interrupteur|luminaire|plafonnier|lustre|spot|va-et-vient)"),
      w("(chauffe-eau|chauffe eau|cumulus|ballon d'eau chaude)"),
      w("resistance (du |de )?(chauffe-eau|ballon|four|lave)"),
      w("(cable|fil) electrique"),
    ],
  },
  {
    hazard: "height",
    level: 2,
    patterns: [w("toit(ure)?"), w("gouttiere"), w("(grande |haute )?echelle"), w("antenne")],
  },
  {
    hazard: "chemical",
    level: 2,
    patterns: [
      w("(melanger|melange).{0,40}(javel|acide|deboucheur|ammoniaque)"),
      w("(javel|acide|deboucheur|soude caustique).{0,40}(melange|avec|et)"),
      w("soude caustique"),
    ],
  },

  // ---- Niveau 1 : précautions ---------------------------------------------
  {
    hazard: "water",
    level: 1,
    pro: "plombier",
    patterns: [
      w("fuite"),
      w("robinet"),
      w("siphon"),
      w("chasse d'eau"),
      w("evier|lavabo|douche|baignoire|wc|toilettes"),
      w("joint"),
      w("radiateur"),
      w("bouche|degorger|deboucher"),
    ],
  },
  {
    hazard: "appliance",
    level: 1,
    pro: "electromenager",
    patterns: [
      w("lave-linge|lave linge|machine a laver"),
      w("lave-vaisselle|lave vaisselle"),
      w("refrigerateur|frigo|congelateur"),
      w("seche-linge|seche linge"),
      w("four|micro-ondes|aspirateur|hotte"),
    ],
  },
];

const NEGATIONS = /(pas|plus|aucune?|sans|jamais|ni)( [a-z']+){0,3} ?$/;

function matchRule(text: string, rule: RiskRule): { matched: boolean; negated: boolean } {
  let negatedOnly = false;
  for (const p of rule.patterns) {
    const m = p.exec(text);
    if (!m) continue;
    if (!rule.negatable) return { matched: true, negated: false };
    const before = text.slice(Math.max(0, m.index - 30), m.index + (m[1]?.length ?? 0));
    if (NEGATIONS.test(before.trim())) {
      negatedOnly = true;
      continue;
    }
    return { matched: true, negated: false };
  }
  return { matched: negatedOnly, negated: negatedOnly };
}

/** Classe un texte (message, transcription vocale, description de photo). */
export function classifyText(input: string): RiskResult {
  const text = normalize(input);
  let level: RiskLevel = 0;
  let pro: string | undefined;
  let proLevel = -1;
  const hazards = new Set<Hazard>();

  for (const rule of RULES) {
    const { matched, negated } = matchRule(text, rule);
    if (!matched) continue;
    // « ça ne sent pas le gaz » : on reste prudent (niveau 3, pas de tutoriel), sans écran d'urgence.
    const ruleLevel = (negated ? rule.level - 1 : rule.level) as RiskLevel;
    hazards.add(rule.hazard);
    if (ruleLevel > level) level = ruleLevel;
    if (rule.pro && ruleLevel > proLevel) {
      pro = rule.pro;
      proLevel = ruleLevel;
    }
  }
  return { level, hazards: [...hazards], pro };
}

/** Combine plusieurs avis (règles, IA, niveau déjà atteint) : on garde toujours le plus élevé. */
export function combine(...results: Array<RiskResult | undefined>): RiskResult {
  let best: RiskResult = { level: 0, hazards: [] };
  const hazards = new Set<Hazard>();
  for (const r of results) {
    if (!r) continue;
    r.hazards.forEach((h) => hazards.add(h));
    if (r.level > best.level || (r.level === best.level && !best.pro && r.pro)) best = r;
  }
  return { level: best.level, pro: best.pro, hazards: [...hazards] };
}

/** Le tutoriel pas à pas est-il autorisé à ce niveau ? */
export const tutorialAllowed = (level: RiskLevel) => level <= 1;
