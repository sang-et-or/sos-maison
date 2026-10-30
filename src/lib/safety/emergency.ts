/**
 * Consignes affichées par l'écran d'urgence (niveau 4) et par l'écran
 * « professionnel requis » (niveau 3). Textes fixes, relus, jamais générés par l'IA.
 */
import type { Hazard, RiskLevel } from "./risk";

export interface EmergencyNumber {
  label: string;
  tel: string;
  display: string;
}

export const NUMBERS = {
  european: { label: "Urgences (Europe)", tel: "112", display: "112" },
  firefighters: { label: "Pompiers", tel: "18", display: "18" },
  samu: { label: "SAMU", tel: "15", display: "15" },
  gas: { label: "Urgence sécurité gaz (GRDF)", tel: "0800473333", display: "0 800 47 33 33" },
} satisfies Record<string, EmergencyNumber>;

export interface Guidance {
  title: string;
  steps: string[];
  numbers: EmergencyNumber[];
}

const G: Partial<Record<Hazard, Guidance>> = {
  gas: {
    title: "Possible fuite de gaz",
    steps: [
      "Ne touchez à aucun interrupteur, aucune lumière, aucune prise ni sonnette.",
      "N'allumez pas de flamme, de cigarette ou de briquet.",
      "Ouvrez grand les fenêtres et les portes.",
      "Si vous le pouvez sans danger, fermez le robinet de gaz au compteur.",
      "Sortez du logement avec tout le monde et n'y retournez pas.",
      "Une fois dehors, appelez l'urgence gaz ou le 112.",
    ],
    numbers: [NUMBERS.gas, NUMBERS.european, NUMBERS.firefighters],
  },
  fire: {
    title: "Fumée ou début d'incendie",
    steps: [
      "Sortez immédiatement et faites sortir tout le monde.",
      "Fermez la porte de la pièce derrière vous, sans la verrouiller.",
      "N'utilisez jamais d'eau sur un feu électrique ou de friture.",
      "Appelez les pompiers une fois en sécurité.",
      "Ne retournez pas à l'intérieur.",
    ],
    numbers: [NUMBERS.firefighters, NUMBERS.european],
  },
  electric_shock: {
    title: "Danger électrique",
    steps: [
      "Ne touchez pas l'appareil, la prise ni une personne en contact avec le courant.",
      "Coupez le courant au disjoncteur général si vous pouvez l'atteindre sans risque.",
      "Si quelqu'un a été électrisé, appelez le 15 même s'il semble aller bien.",
      "Ne réutilisez pas la prise ou l'appareil avant le passage d'un électricien.",
    ],
    numbers: [NUMBERS.samu, NUMBERS.european, NUMBERS.firefighters],
  },
  carbon_monoxide: {
    title: "Possible intoxication au monoxyde de carbone",
    steps: [
      "Ouvrez immédiatement portes et fenêtres.",
      "Arrêtez si possible la chaudière, le poêle ou le chauffe-eau.",
      "Sortez du logement avec tout le monde.",
      "Appelez le 15, le 18 ou le 112 : les maux de tête et nausées sont des signes d'alerte.",
      "Ne revenez qu'après le passage d'un professionnel.",
    ],
    numbers: [NUMBERS.samu, NUMBERS.firefighters, NUMBERS.european],
  },
  flood_electric: {
    title: "Eau et électricité",
    steps: [
      "Ne marchez pas dans l'eau et ne touchez aucun appareil électrique.",
      "Coupez le courant au disjoncteur général s'il est au sec et accessible.",
      "Coupez l'arrivée d'eau au robinet d'arrêt général.",
      "Appelez les pompiers si l'eau monte ou si vous ne pouvez pas couper le courant.",
    ],
    numbers: [NUMBERS.firefighters, NUMBERS.european],
  },
  structure: {
    title: "Risque d'effondrement",
    steps: [
      "Éloignez-vous de la zone et faites sortir les occupants de la pièce.",
      "Ne posez rien et ne montez pas sur la zone fragilisée.",
      "Si l'effondrement semble imminent, sortez et appelez les pompiers.",
    ],
    numbers: [NUMBERS.firefighters, NUMBERS.european],
  },
  injury: {
    title: "Personne blessée",
    steps: [
      "Mettez la personne et vous-même à l'abri du danger.",
      "Appelez le 15 ou le 112 et suivez les consignes de l'opérateur.",
    ],
    numbers: [NUMBERS.samu, NUMBERS.european],
  },
};

const PRO_ONLY: Partial<Record<Hazard, string>> = {
  gas_appliance: "Les interventions sur une chaudière ou un appareil au gaz sont réservées à un professionnel qualifié. Je peux vous aider à décrire la panne et à trouver un chauffagiste.",
  electrical_panel: "Le tableau électrique et les câbles nus doivent être confiés à un électricien. Je peux vous aider à trouver un professionnel près de chez vous.",
  structure: "Les murs porteurs, poutres et fissures demandent l'avis d'un professionnel du bâtiment avant toute intervention.",
  asbestos: "Ne percez, ne poncez et ne cassez pas un matériau qui pourrait contenir de l'amiante. Un diagnostic par un professionnel certifié est nécessaire.",
};

export function emergencyGuidance(hazards: Hazard[]): Guidance[] {
  return hazards.map((h) => G[h]).filter((g): g is Guidance => Boolean(g));
}

export function proOnlyMessage(hazards: Hazard[]): string {
  for (const h of hazards) if (PRO_ONLY[h]) return PRO_ONLY[h]!;
  return "Cette intervention présente des risques : je vous recommande de faire appel à un professionnel qualifié.";
}

/** Instruction ajoutée au prompt système selon le niveau de risque (garde-fou côté IA). */
export function systemGuardrail(level: RiskLevel): string {
  switch (level) {
    case 4:
      return "URGENCE détectée. Ne donne AUCUNE instruction de réparation. Répète en deux phrases les gestes de mise en sécurité affichés à l'écran et invite à appeler les secours.";
    case 3:
      return "Intervention réservée à un professionnel. Ne donne AUCUN tutoriel de démontage ou de réparation. Tu peux expliquer ce qui se passe probablement, les vérifications visuelles sans risque, et proposer l'annuaire d'artisans.";
    case 2:
      return "Risque modéré. Limite-toi aux vérifications sans démontage ni ouverture d'appareil et sans travail sous tension. Propose un artisan pour la réparation elle-même.";
    case 1:
      return "Tu peux donner un tutoriel complet, en commençant obligatoirement par les mesures de sécurité (couper l'eau ou l'électricité, débrancher, gants, lunettes).";
    default:
      return "Tu peux donner un tutoriel complet et simple.";
  }
}
