/**
 * Adresse publique du site, pour les liens envoyés par e-mail et les redirections.
 * Derrière un hébergeur (Render, Vercel), l'adresse vue par le serveur peut être interne (localhost) :
 * on utilise APP_URL si elle est valide, sinon les en-têtes transmis par l'hébergeur.
 */
export function publicOrigin(req: Request): string {
  const env = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (env && /^https?:\/\/[^/\s]+$/.test(env) && !/localhost|127\.0\.0\.1/.test(env)) return env;
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host");
  if (host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  }
  return env || new URL(req.url).origin;
}
