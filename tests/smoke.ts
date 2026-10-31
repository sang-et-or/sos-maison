/**
 * Test de bout en bout sur le site compilé (lancé par l'intégration continue).
 * N'a besoin d'aucune clé d'API : le parcours d'urgence n'appelle pas l'IA.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";
import { signStripePayload } from "../src/lib/billing/stripe";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, ssl: false, onnotice: () => {} });

async function get(path: string, init?: RequestInit) {
  return fetch(BASE + path, { redirect: "manual", ...init });
}
const json = (cookie: string, method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body),
});

/** Ouvre une session pour un e-mail (jeton de connexion créé directement en base). */
async function login(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await sql`insert into login_tokens (token_hash, email, expires_at)
            values (${createHash("sha256").update(token).digest("hex")}, ${email}, now() + interval '10 minutes')`;
  const r = await get(`/api/auth/verify?token=${token}&next=/`);
  return (r.headers.get("set-cookie") ?? "").split(";")[0];
}

async function main() {
  // Pages publiques
  let r = await get("/");
  assert.equal(r.status, 200);
  const home = await r.text();
  assert.match(home, /Quel est votre problème/);
  assert.match(home.replace(/\u00a0|&nbsp;/g, " "), /0 800 47 33 33/);
  for (const p of ["/guides", "/guides/radiateur", "/installer", "/connexion", "/cgu", "/confidentialite", "/mentions-legales", "/manifest.webmanifest", "/sw.js", "/icons/icon-192.png"]) {
    r = await get(p);
    assert.equal(r.status, 200, p);
  }
  r = await get("/guides/radiateur");
  assert.match(await r.text(), /Purger un radiateur/);
  r = await get("/guides/inconnu");
  assert.equal(r.status, 404);
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
                          values (${rep2.id}, 'assistant', 'Fiche', ${JSON.stringify({ titre: "Régler le flotteur", diagnostic: "Flotteur trop haut", securite: "Fermez le robinet", outils: ["Tournevis"], etapes: ["a", "b", "c"], economie_estimee_eur: 110 })}::text::jsonb)
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

  // Espace artisan : inscription, fiche invisible jusqu'à validation
  const proBody = { companyName: "Smoke Plomberie", siret: "73282932000074", categories: ["plombier"], city: "Lyon", postalCode: "69003",
    departments: "69", phone: "04 72 00 00 00", email: "smoke-pro@example.fr", website: "", description: "Test", certify: true };
  r = await get("/api/pro", json(cookie, "POST", { ...proBody, siret: "73282932000075" }));
  assert.equal(r.status, 400, "SIRET invalide refusé");
  r = await get("/api/pro", json(cookie, "POST", proBody));
  assert.equal(r.status, 200, await r.clone().text());
  const newPro = (await r.json()).id as string;
  r = await get("/api/pro", json(cookie, "POST", proBody));
  assert.equal(r.status, 409, "une seule fiche par compte");
  r = await get("/pro", { headers: { cookie } });
  assert.match(await r.text(), /En cours de vérification/);
  r = await get("/artisans?cp=69003&metier=plombier");
  assert.doesNotMatch(await r.text(), /Smoke Plomberie/, "invisible avant validation");
  r = await get(`/api/admin/pros/${newPro}`, json(cookie, "PATCH", { status: "verified" }));
  assert.equal(r.status, 403, "validation réservée à l'administration");
  console.log("✓ inscription artisan");

  // Administration
  const admin = await login("admin-smoke@example.fr");
  r = await get("/admin", { headers: { cookie: admin } });
  const adminPage = await r.text();
  assert.match(adminPage, /Artisans à vérifier/);
  assert.match(adminPage, /Smoke Plomberie/);
  r = await get(`/api/admin/pros/${newPro}`, json(admin, "PATCH", { status: "verified", note: "SIRET vérifié" }));
  assert.equal(r.status, 200);
  r = await get("/artisans?cp=69003&metier=plombier");
  assert.match(await r.text(), /Smoke Plomberie/, "visible après validation");
  r = await get("/api/admin/credits", json(admin, "POST", { email, amount: 50, reason: "test smoke" }));
  assert.equal((await r.json()).balance, 150);
  r = await get("/api/admin/settings", json(admin, "PATCH", { key: "welcome_credits", value: -5 }));
  assert.equal(r.status, 400, "réglage invalide refusé");
  r = await get("/api/admin/settings", json(admin, "PATCH", { key: "google_search_daily_limit", value: 12 }));
  assert.equal(r.status, 200);
  console.log("✓ administration");

  // Demande reçue puis traitée par l'artisan
  r = await get("/api/requests", json(cookie, "POST", { proId: newPro, name: "Client Test", phone: "06 11 11 11 11", postalCode: "69003", message: "Robinet qui fuit, merci de me rappeler." }));
  assert.equal(r.status, 200, await r.clone().text());
  const [req] = await sql`select id from service_requests where pro_id = ${newPro}`;
  r = await get("/pro", { headers: { cookie } });
  assert.match(await r.text(), /Client Test/);
  r = await get(`/api/pro/requests/${req.id}`, json(cookie, "PATCH", { status: "accepted" }));
  assert.equal(r.status, 200);
  r = await get(`/api/pro/requests/${req.id}`, json(admin, "PATCH", { status: "done" }));
  assert.equal(r.status, 404, "seul l'artisan concerné peut répondre");
  console.log("✓ demandes côté artisan");

  // Paiements Stripe (webhooks signés, sans appel à Stripe)
  r = await get("/api/billing/checkout", { method: "POST", headers: { cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: "offre=monthly" });
  assert.equal(r.status, 303);
  assert.match(r.headers.get("location") ?? "", /paiement=indisponible/, "sans clé Stripe, aucun paiement");
  const [{ id: uid }] = await sql`select id from users where email = ${email}`;
  const hook = async (event: unknown, signed = true) => {
    const body = JSON.stringify(event);
    return get("/api/billing/webhook", { method: "POST", body, headers: { "Content-Type": "application/json",
      "stripe-signature": signed ? signStripePayload(body, process.env.STRIPE_WEBHOOK_SECRET!) : "t=1,v1=00" } });
  };
  const subEvent = { id: `evt_sub_${Date.now()}`, type: "customer.subscription.created", data: { object: {
    id: "sub_smoke", customer: "cus_smoke", status: "active", cancel_at_period_end: false, metadata: { user_id: uid },
    items: { data: [{ current_period_start: Math.floor(Date.now() / 1000), current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, price: { recurring: { interval: "month" } } }] } } } };
  r = await hook(subEvent, false);
  assert.equal(r.status, 400, "signature exigée");
  r = await hook(subEvent);
  assert.equal((await r.json()).result, "ok");
  r = await hook(subEvent);
  assert.equal((await r.json()).result, "déjà traité");
  r = await get("/compte", { headers: { cookie } });
  assert.match(await r.text(), /Premium mensuel/);
  const packEvent = { id: `evt_pack_${Date.now()}`, type: "checkout.session.completed", data: { object: {
    id: "cs_smoke", mode: "payment", payment_status: "paid", metadata: { kind: "pack", credits: "100", user_id: uid } } } };
  await hook(packEvent);
  await hook(packEvent);
  const [{ credit_balance: afterPack }] = await sql`select credit_balance from users where id = ${uid}`;
  assert.equal(afterPack, 250, "pack crédité une seule fois");
  console.log("✓ abonnement et pack de crédits");

  // Comptes avec mot de passe
  const pwEmail = `pw-${Date.now()}@example.fr`;
  r = await get("/api/auth/signup", json("", "POST", { email: pwEmail, password: "12345678", acceptTerms: true }));
  assert.equal(r.status, 400, "mot de passe trop faible refusé");
  r = await get("/api/auth/signup", json("", "POST", { email: pwEmail, password: "Radiateur2026", acceptTerms: true }));
  assert.equal(r.status, 200, await r.clone().text());
  const pwCookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  r = await get("/compte", { headers: { cookie: pwCookie } });
  const pwPage = await r.text();
  assert.match(pwPage, />100</, "100 crédits à l'inscription");
  assert.match(pwPage, /protégé par un mot de passe/);
  r = await get("/api/auth/signup", json("", "POST", { email: pwEmail, password: "Radiateur2026", acceptTerms: true }));
  assert.equal(r.status, 409, "pas de deuxième compte");
  r = await get("/api/auth/login", json("", "POST", { email: pwEmail.toUpperCase(), password: "Mauvais2026" }));
  assert.equal(r.status, 401);
  r = await get("/api/auth/login", json("", "POST", { email: ` ${pwEmail.toUpperCase()} `, password: "Radiateur2026" }));
  assert.equal(r.status, 200, "connexion par mot de passe");
  assert.match(r.headers.get("set-cookie") ?? "", /sm_session=/);
  r = await get("/api/auth/login", json("", "POST", { email, password: "Nimporte2026" }));
  assert.equal((await r.json()).code, "no_password", "compte créé par lien : invité à choisir un mot de passe");
  r = await get("/api/auth/password", json(pwCookie, "POST", { current: "Faux2026xx", password: "Nouveau2026" }));
  assert.equal(r.status, 403, "ancien mot de passe exigé");
  r = await get("/api/auth/password", json(pwCookie, "POST", { current: "Radiateur2026", password: "Nouveau2026" }));
  assert.equal(r.status, 200);
  r = await get("/api/auth/login", json("", "POST", { email: pwEmail, password: "Nouveau2026" }));
  assert.equal(r.status, 200, "nouveau mot de passe actif");
  for (let i = 0; i < 8; i++) await get("/api/auth/login", json("", "POST", { email: pwEmail, password: `Faux${i}abcd` }));
  r = await get("/api/auth/login", json("", "POST", { email: pwEmail, password: "Nouveau2026" }));
  assert.equal(r.status, 429, "trop d'essais : blocage temporaire");
  console.log("✓ comptes avec mot de passe");

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
