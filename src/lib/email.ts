import "server-only";

/** Envoie l'e-mail de connexion. Sans clé Resend (développement), le lien est écrit dans la console. */
export async function sendLoginEmail(to: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:17px;line-height:1.5;color:#0b2a5c">
      <p>Bonjour,</p>
      <p>Pour vous connecter à SOS Maison, appuyez sur le bouton ci-dessous. Le lien est valable 15 minutes.</p>
      <p><a href="${link}" style="display:inline-block;background:#1f6feb;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:600">Me connecter</a></p>
      <p style="color:#555;font-size:14px">Si vous n'avez rien demandé, ignorez simplement cet e-mail.</p>
    </div>`;

  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY manquant en production");
    console.info(`[dev] Lien de connexion pour ${to} : ${link}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "SOS Maison <onboarding@resend.dev>",
      to,
      subject: "Votre lien de connexion SOS Maison",
      html,
    }),
  });
  if (!res.ok) throw new Error(`Envoi e-mail impossible (${res.status})`);
}
