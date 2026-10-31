import { z } from "zod";

/** Vérifie la clé de contrôle d'un SIRET (algorithme de Luhn ; règle particulière pour La Poste). */
export function isValidSiret(raw: string): boolean {
  const s = raw.replace(/\s/g, "");
  if (!/^[0-9]{14}$/.test(s)) return false;
  if (s.startsWith("356000000")) {
    return [...s].reduce((a, c) => a + Number(c), 0) % 5 === 0;
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(s[13 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const DEPT = /^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$/;

/** « 69, 01 ; 38 » → ["69","01","38"] (départements valides uniquement, sans doublon). */
export function parseDepartments(input: string): string[] {
  const out = input.toUpperCase().split(/[\s,;]+/).map((d) => d.trim()).filter((d) => DEPT.test(d));
  return [...new Set(out)].slice(0, 20);
}

export const ProInput = z.object({
  companyName: z.string().trim().min(2, "Nom de l'entreprise trop court.").max(120),
  siret: z.string().transform((s) => s.replace(/\s/g, "")).refine(isValidSiret, "Ce numéro SIRET n'est pas valide."),
  categories: z.array(z.string().regex(/^[a-z]+$/)).min(1, "Choisissez au moins un métier.").max(6),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().regex(/^[0-9]{5}$/, "Code postal invalide."),
  departments: z.string().max(200).default(""),
  phone: z.string().trim().regex(/^[0-9 +().-]{8,20}$/, "Numéro de téléphone invalide."),
  email: z.string().trim().max(254).email("E-mail invalide."),
  website: z.string().trim().max(200).regex(/^https?:\/\/\S+$/, "Le site doit commencer par https://").optional().or(z.literal("")),
  description: z.string().trim().max(600).optional().or(z.literal("")),
  certify: z.literal(true, { errorMap: () => ({ message: "Merci de certifier l'exactitude des informations." }) }),
});
export type ProInputT = z.infer<typeof ProInput>;

export const REQUEST_STATUS = ["sent", "seen", "accepted", "declined", "done"] as const;
export const REQUEST_LABEL: Record<(typeof REQUEST_STATUS)[number], string> = {
  sent: "Nouvelle",
  seen: "Vue",
  accepted: "Acceptée",
  declined: "Refusée",
  done: "Terminée",
};
