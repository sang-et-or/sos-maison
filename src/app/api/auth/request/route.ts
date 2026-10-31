import { publicOrigin } from "@/lib/url";
import { z } from "zod";
import { headers } from "next/headers";
import { createLoginToken, errorResponse, HttpError, isValidEmail } from "@/lib/auth";
import { sendLoginEmail } from "@/lib/email";
import { sql } from "@/lib/db";

const Body = z.object({
  email: z.string().max(254),
  acceptTerms: z.literal(true),
  next: z.string().max(200).optional(),
  reset: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Merci d'indiquer votre e-mail et d'accepter les conditions.");
    const { email, next, reset } = parsed.data;
    if (!isValidEmail(email)) throw new HttpError(400, "Cette adresse e-mail ne semble pas valide.");

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    // Mot de passe oublié : rien n'est envoyé (ni créé) si aucun compte n'existe, sans le révéler.
    if (reset) {
      const [u] = await sql`select 1 from users where email = ${email.trim().toLowerCase()} and deleted_at is null`;
      if (!u) return Response.json({ ok: true });
    }
    const token = await createLoginToken(email, ip);
    // Même réponse si limite atteinte : on ne révèle rien sur l'existence du compte.
    if (token) {
      const base = publicOrigin(req);
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      const link = `${base}/api/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNext)}`;
      await sendLoginEmail(email.trim().toLowerCase(), link, Boolean(reset));
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
