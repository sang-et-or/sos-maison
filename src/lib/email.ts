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
  if (!res.ok) throw new Error(`Envoi e-mail impossible (${res.status}) : ${(await res.text()).slice(0, 300)}`);
}

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Demande d'intervention transmise à un artisan. */
export async function sendServiceRequestEmail(to: string, r: {
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  postalCode: string;
  message: string;
  summary?: string | null;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const rows = [
    ["Nom", r.contactName],
    ["Téléphone", r.contactPhone ?? "—"],
    ["E-mail", r.contactEmail ?? "—"],
    ["Code postal", r.postalCode],
  ];
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1b1f3b">
      <h2 style="margin:0 0 12px">Nouvelle demande d'intervention</h2>
      <table style="border-collapse:collapse">${rows
        .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5d6480">${k}</td><td><strong>${esc(v)}</strong></td></tr>`)
        .join("")}</table>
      <p style="margin:16px 0 4px;color:#5d6480">Message</p>
      <p style="white-space:pre-wrap;margin:0">${esc(r.message)}</p>
      ${r.summary ? `<p style="margin:16px 0 4px;color:#5d6480">Résumé du diagnostic SOS Maison (partagé avec l'accord du client)</p><p style="white-space:pre-wrap;margin:0">${esc(r.summary)}</p>` : ""}
      <p style="margin-top:20px;color:#5d6480;font-size:14px">Contactez directement le client. SOS Maison ne prend aucune commission.</p>
    </div>`;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY manquant en production");
    console.info(`[dev] Demande d'intervention pour ${to} :`, r);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "SOS Maison <onboarding@resend.dev>",
      to,
      reply_to: r.contactEmail ?? undefined,
      subject: `Demande d'intervention · ${r.postalCode}`,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Envoi e-mail impossible (${res.status}) : ${(await res.text()).slice(0, 300)}`);
}

/** Informe l'artisan de la décision sur sa fiche. */
export async function sendProReviewEmail(to: string, r: { company: string; status: "verified" | "suspended" | "pending"; note?: string | null }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const base = process.env.APP_URL ?? "";
  const body =
    r.status === "verified"
      ? `<p>Bonne nouvelle : la fiche <strong>${esc(r.company)}</strong> est maintenant visible dans l'annuaire SOS Maison. Les demandes des particuliers de votre zone arriveront par e-mail et dans votre espace artisan.</p>`
      : r.status === "suspended"
        ? `<p>La fiche <strong>${esc(r.company)}</strong> n'a pas pu être publiée dans l'annuaire SOS Maison.</p>`
        : `<p>La fiche <strong>${esc(r.company)}</strong> est en cours de vérification.</p>`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1b1f3b">${body}${
    r.note ? `<p><strong>Message de l'équipe :</strong> ${esc(r.note)}</p>` : ""
  }<p><a href="${base}/pro">Ouvrir mon espace artisan</a></p></div>`;
  if (!key) {
    console.info(`[dev] Décision artisan pour ${to} : ${r.status}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "SOS Maison <onboarding@resend.dev>", to, subject: `Votre fiche SOS Maison : ${r.status === "verified" ? "en ligne" : "mise à jour"}`, html }),
  });
  if (!res.ok) throw new Error(`Envoi e-mail impossible (${res.status}) : ${(await res.text()).slice(0, 300)}`);
}
