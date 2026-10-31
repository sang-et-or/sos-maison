import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Mots de passe : scrypt (inclus dans Node), sel aléatoire, comparaison à temps constant. */
const N = 16384, R = 8, P = 1, LEN = 64;

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, LEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Règle simple et lisible : 8 caractères minimum, pas uniquement des chiffres, pas l'e-mail. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (password.length > 200) return "Mot de passe trop long.";
  if (/^\d+$/.test(password)) return "Ajoutez au moins une lettre à votre mot de passe.";
  if (email && password.toLowerCase() === email.trim().toLowerCase()) return "Le mot de passe ne doit pas être votre e-mail.";
  if (/^(.)\1+$/.test(password) || ["motdepasse", "password", "azertyuiop", "12345678a"].includes(password.toLowerCase()))
    return "Ce mot de passe est trop facile à deviner.";
  return null;
}
