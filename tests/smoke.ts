/**
 * Test de bout en bout sur le site compilé (lancé par l'intégration continue).
 * N'a besoin d'aucune clé d'API : le parcours d'urgence n'appelle pas l'IA.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, ssl: false, onnotice: () => {} });

async function get(path: string, init?: RequestInit) {
  return fetch(BASE + path, { redirect: "manual", ...init });
}

async function main() {
  // Pages publiques
  let r = await get("/");
  assert.equal(r.status, 200);
  const home = await r.text();
  assert.match(home, /Quel est votre problème/);
  assert.match(home, /0&nbsp;800&nbsp;47&nbsp;33&nbsp;33|0 800 47 33 33/);
  for (const p of ["/connexion", "/cgu", "/confidentialite", "/mentions-legales", "/manifest.webmanifest", "/sw.js", "/icons/icon-192.png"]) {
    r = await get(p);
    assert.equal(r.status, 200, p);
  }
  r = await get("/artisans?cp=69006&metier=plombier");
  assert.match(await r.text(), /Démo Plomberie Rhône/);
  r = await get("/artisans?cp=13001&metier=plombier");
  assert.match(await r.text(), /Pas encore d(&#x27;|')artisan/);
  console.log("✓ pages publiques");

  // Accès protégé
  r = await get("/depannage/nouveau");
  assert.ok([307, 308].includes(r.status) && r.headers.get("location")?.includes("/connexion"), "redirection connexion");
  r = await get("/api/chat", { method: "POST", body: JSON.stringify({ text: "test" }), headers: { "Content-Type": "application/json" } });
  assert.equal(r.status, 401);
  console.log("✓ accès protégé");

  // Connexion par lien magique (jeton créé directement en base)
  const token = randomBytes(32).toString("base64url");
  const email = `smoke-${Date.now()}@example.fr`;
  await sql`insert into login_tokens (token_hash, email, expires_at)
            values (${createHash("sha256").update(token).digest("hex")}, ${email}, now() + interval '10 minutes')`;
  r = await get(`/api/auth/verify?token=${token}&next=/compte`);
  assert.equal(r.status, 307);
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  assert.match(cookie, /^sm_session=/);
  r = await get(`/api/auth/verify?token=${token}&next=/compte`);
  assert.match(r.headers.get("location") ?? "", /erreur=expire/, "jeton à usage unique");
  r = await get("/compte", { headers: { cookie } });
  const account = await r.text();
  assert.match(account, new RegExp(email.replace(/[.]/g, "\\.")));
  assert.match(account, />100</, "100 crédits offerts");
  console.log("✓ connexion et compte");

  // Parcours d'urgence : écran d'urgence, aucun crédit débité
  r = await get("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ text: "Ça sent le gaz dans la cuisine depuis ce matin" }),
  });
  assert.equal(r.status, 200);
  const events = (await r.text()).trim().split("\n").map((l) => JSON.parse(l));
  const types = events.map((e) => e.type);
  assert.ok(types.includes("repair") && types.includes("emergency") && types.includes("done"), types.join(","));
  const em = events.find((e) => e.type === "emergency");
  assert.match(JSON.stringify(em.guidance), /0 800 47 33 33/);
  const [{ credit_balance }] = await sql`select credit_balance from users where email = ${email}`;
  assert.equal(credit_balance, 100, "l'urgence n'est jamais facturée");
  const repairId = events.find((e) => e.type === "repair").repairId;
  const [repair] = await sql`select risk_level, status from repairs where id = ${repairId}`;
  assert.equal(repair.risk_level, 4);
  assert.equal(repair.status, "needs_pro");
  console.log("✓ parcours d'urgence");

  // Fiche de réparation : étapes à cocher (fiche insérée directement, sans appel à l'IA)
  const [rep2] = await sql`insert into repairs (user_id, title)
                           select id, 'Chasse d''eau' from users where email = ${email} returning id`;
  const [msg] = await sql`insert into messages (repair_id, role, content, card)
                          values (${rep2.id}, 'assistant', 'Fiche', ${JSON.stringify({ titre: "Régler le flotteur", diagnostic: "Flotteur trop haut", securite: "Fermez le robinet", outils: ["Tournevis"], etapes: ["a", "b", "c"], economie_estimee_eur: 110 })}::jsonb)
                          returning id`;
  r = await get(`/api/messages/${msg.id}/steps`, {
    method: "PATCH", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ step: 2, done: true }),
  });
  assert.deepEqual((await r.json()).done, [2]);
  r = await get(`/depannage/${rep2.id}`, { headers: { cookie } });
  assert.match(await r.text(), /Régler le flotteur/);
  r = await get(`/api/repairs/${rep2.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ status: "resolved" }),
  });
  assert.equal(r.status, 200);
  const [saved] = await sql`select estimated_saving_eur from repairs where id = ${rep2.id}`;
  assert.equal(saved.estimated_saving_eur, 110);
  r = await get("/compte", { headers: { cookie } });
  assert.match(await r.text(), /≈110 €/);
  console.log("✓ fiche de réparation et économies");

  // Demande d'intervention avec partage du résumé
  const [pro] = await sql`select id from pros where company_name = 'Démo Plomberie Rhône'`;
  r = await get("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ proId: pro.id, repairId: rep2.id, name: "Marie Test", phone: "06 00 00 00 00", postalCode: "69006", message: "Fuite sous l'évier, merci de me rappeler.", consentShare: true }),
  });
  assert.equal(r.status, 200, await r.clone().text());
  const [sr] = await sql`select shared_summary, consent_share from service_requests where pro_id = ${pro.id} order by created_at desc limit 1`;
  assert.ok(sr.consent_share && /Flotteur trop haut/.test(sr.shared_summary));
  console.log("✓ demande d'intervention");

  // Export et suppression RGPD
  r = await get("/api/account/export", { headers: { cookie } });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /sent le gaz/);
  r = await get("/api/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ confirm: "SUPPRIMER" }),
  });
  assert.equal(r.status, 200);
  r = await get("/compte", { headers: { cookie } });
  assert.ok([307, 308].includes(r.status), "session supprimée");
  console.log("✓ export et suppression des données");

  await sql.end();
  console.log("Tous les tests de bout en bout passent.");
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
