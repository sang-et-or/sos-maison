/**
 * Captures d'écran des pages principales (téléphone), pour relecture visuelle.
 * Lancé par l'intégration continue après le test de bout en bout.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import postgres from "postgres";
import { chromium } from "playwright";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, ssl: false, onnotice: () => {} });

async function session(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await sql`insert into login_tokens (token_hash, email, expires_at)
            values (${createHash("sha256").update(token).digest("hex")}, ${email}, now() + interval '10 minutes')`;
  const r = await fetch(`${BASE}/api/auth/verify?token=${token}&next=/`, { redirect: "manual" });
  return (r.headers.get("set-cookie") ?? "").split(";")[0].split("=")[1];
}

async function main() {
  mkdirSync("captures", { recursive: true });
  const user = await session("marie.captures@example.fr");
  const admin = await session("admin-smoke@example.fr");
  // Une fiche artisan en attente avec une demande, pour illustrer l'espace artisan et l'administration.
  const [u] = await sql`select id from users where email = 'marie.captures@example.fr'`;
  const [pro] = await sql`insert into pros (user_id, company_name, siret, city, postal_code, service_departments, phone, email, description, status)
    values (${u.id}, 'Plomberie Martin', '73282932000074', 'Lyon', '69003', '{69}', '04 72 00 00 00', 'martin@example.fr', 'Dépannage plomberie 7j/7', 'verified')
    on conflict do nothing returning id`;
  if (pro) {
    await sql`insert into pro_category_links values (${pro.id}, 'plombier')`;
    await sql`insert into service_requests (pro_id, contact_name, contact_phone, postal_code, message, shared_summary, consent_share)
      values (${pro.id}, 'Julie D.', '06 12 34 56 78', '69003', 'Fuite sous l''évier depuis ce matin, pouvez-vous passer ?',
              'Problème : fuite sous l''évier' || chr(10) || 'Diagnostic proposé : joint du siphon usé', true)`;
  }
  await sql`insert into pros (company_name, siret, city, postal_code, phone, email, status)
    values ('Élec Rapide Lyon', '44306184100047', 'Lyon', '69007', '04 78 00 00 00', 'elec@example.fr', 'pending')`;

  const browser = await chromium.launch();
  const shots: [string, string, string | null][] = [
    ["01-accueil", "/", user],
    ["02-guides", "/guides", null],
    ["03-guide-radiateur", "/guides/radiateur", null],
    ["04-conversation", "/depannage/nouveau", user],
    ["05-compte", "/compte", user],
    ["06-espace-artisan", "/pro", user],
    ["07-inscription-artisan", "/pro", admin],
    ["08-administration", "/admin", admin],
    ["09-artisans", "/artisans?cp=69003&metier=plombier", user],
    ["10-installer", "/installer", null],
  ];
  for (const [name, path, cookie] of shots) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
    if (cookie) await ctx.addCookies([{ name: "sm_session", value: cookie, url: BASE }]);
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `captures/${name}.png`, fullPage: true });
    await ctx.close();
    console.log(`✓ ${name}`);
  }
  await browser.close();
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
