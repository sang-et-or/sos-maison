import { test } from "node:test";
import assert from "node:assert/strict";
import { formEncode, verifyStripeSignature, signStripePayload, mapSubscriptionStatus, readSubscription } from "../src/lib/billing/stripe";
import { isValidSiret, parseDepartments, ProInput } from "../src/lib/pros";
import { validateSetting, monthlyRevenueCents } from "../src/lib/admin";
import { GUIDES, ILLUSTRATIONS, SEASONS, seasonOf, suggestGuide, guideById } from "../src/lib/guides";
import { toSpeech, speechChunks } from "../src/components/media";

test("Stripe : encodage des paramètres imbriqués", () => {
  const s = formEncode({ mode: "payment", line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: 199 } }], metadata: { user_id: "u 1" }, skip: undefined });
  assert.equal(s, "mode=payment&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=eur&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=199&metadata%5Buser_id%5D=u%201");
});

test("Stripe : signature des webhooks", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  const now = 1_800_000_000;
  const header = signStripePayload(body, secret, now);
  assert.ok(verifyStripeSignature(body, header, secret, now));
  assert.ok(verifyStripeSignature(body, header, secret, now + 299), "dans la tolérance");
  assert.ok(!verifyStripeSignature(body, header, secret, now + 301), "trop ancien");
  assert.ok(!verifyStripeSignature(body + " ", header, secret, now), "contenu modifié");
  assert.ok(!verifyStripeSignature(body, header, "autre", now), "mauvais secret");
  assert.ok(!verifyStripeSignature(body, null, secret, now));
  assert.ok(!verifyStripeSignature(body, "t=abc,v1=00", secret, now));
  assert.ok(verifyStripeSignature(body, `${header},v1=deadbeef`, secret, now), "plusieurs signatures");
});

test("Stripe : statuts et lecture des abonnements", () => {
  assert.equal(mapSubscriptionStatus("active"), "active");
  assert.equal(mapSubscriptionStatus("unpaid"), "past_due");
  assert.equal(mapSubscriptionStatus("incomplete_expired"), "canceled");
  assert.equal(mapSubscriptionStatus("paused"), "canceled");
  const r = readSubscription({ id: "sub_1", customer: "cus_1", status: "active", metadata: { user_id: "u1" },
    items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_731_536_000, price: { recurring: { interval: "year" } } }] } });
  assert.equal(r.plan, "yearly");
  assert.equal(r.userId, "u1");
  assert.equal(r.end?.toISOString(), new Date(1_731_536_000_000).toISOString());
  assert.equal(readSubscription({ id: "s", customer: "c", status: "trialing", current_period_end: 10 }).plan, "monthly");
});

test("Artisans : SIRET et zone d'intervention", () => {
  assert.ok(isValidSiret("73282932000074"));
  assert.ok(isValidSiret("732 829 320 00074"));
  assert.ok(!isValidSiret("73282932000075"));
  assert.ok(!isValidSiret("1234"));
  assert.ok(isValidSiret("35600000000010"), "règle La Poste");
  assert.deepEqual(parseDepartments("69, 01 ;38 69 2a 99 975"), ["69", "01", "38", "2A", "975"]);
  const base = { companyName: "Plomberie Martin", siret: "73282932000074", categories: ["plombier"], city: "Lyon", postalCode: "69003",
    phone: "04 72 00 00 00", email: "contact@martin.fr", certify: true as const };
  assert.ok(ProInput.safeParse(base).success);
  assert.ok(!ProInput.safeParse({ ...base, siret: "73282932000075" }).success);
  assert.ok(!ProInput.safeParse({ ...base, certify: false }).success);
  assert.ok(!ProInput.safeParse({ ...base, website: "javascript:alert(1)" }).success);
});

test("Administration : réglages vérifiés et recettes", () => {
  assert.deepEqual(validateSetting("welcome_credits", 100), { ok: true });
  assert.equal(validateSetting("welcome_credits", -1).ok, false);
  assert.equal(validateSetting("welcome_credits", "100").ok, false);
  assert.equal(validateSetting("inconnu", 1).ok, false);
  assert.equal(validateSetting("credit_pack", { credits: 100, price_cents: 199 }).ok, true);
  assert.equal(validateSetting("credit_pack", { credits: 100, price_cents: 199, x: 1 }).ok, false);
  assert.equal(monthlyRevenueCents({ premium: 10, premium_yearly: 2, packs_month: 3 }, { monthly: 299, yearly: 2990 }, 199), 8 * 299 + Math.round((2 * 2990) / 12) + 3 * 199);
});

test("Guides : contenu complet et cohérent", () => {
  assert.equal(GUIDES.length, 17);
  for (const g of GUIDES) {
    assert.ok(ILLUSTRATIONS[g.ill], `schéma ${g.ill}`);
    assert.ok(g.s.length >= 3, `${g.id} a des étapes`);
    for (const s of g.s) if (s.img) assert.ok(ILLUSTRATIONS[s.img], `schéma ${s.img}`);
    for (const [, u] of g.sources) assert.match(u, /^https:\/\//);
    assert.match(g.bg, /^#/);
  }
  for (const k of Object.keys(SEASONS) as (keyof typeof SEASONS)[]) for (const [, id] of SEASONS[k].items) assert.ok(guideById(id), id);
  assert.equal(seasonOf(new Date(2026, 9, 31)), "automne");
  assert.equal(seasonOf(new Date(2026, 0, 5)), "hiver");
  assert.equal(seasonOf(new Date(2026, 6, 5)), "ete");
  assert.equal(suggestGuide("Mon radiateur est froid en haut")?.id, "radiateur");
  assert.equal(suggestGuide("l'évier est bouché")?.id, "evier");
  assert.equal(suggestGuide("bonjour"), undefined);
});

test("Voix : texte lisible et découpé", () => {
  assert.equal(toSpeech("**Coupez l'eau** [1] puis voir [ce tuto](https://ex.fr/a) https://x.fr"), "Coupez l'eau puis voir ce tuto");
  const parts = speechChunks("Phrase courte. " + "mot ".repeat(120) + "fin.");
  assert.ok(parts.length >= 3 && parts.every((p) => p.length <= 220));
  assert.equal(parts[0], "Phrase courte.");
});

import { publicOrigin } from "../src/lib/url";
test("Adresse publique du site derrière l'hébergeur", () => {
  const req = (h: Record<string, string>) => new Request("http://localhost:10000/api/x", { headers: h });
  delete process.env.APP_URL;
  assert.equal(publicOrigin(req({ "x-forwarded-host": "sos-maison.onrender.com", "x-forwarded-proto": "https" })), "https://sos-maison.onrender.com");
  process.env.APP_URL = "http://localhost:3000";
  assert.equal(publicOrigin(req({ host: "sos-maison.onrender.com" })), "https://sos-maison.onrender.com", "APP_URL locale ignorée en ligne");
  process.env.APP_URL = "https://sos-maison.fr/";
  assert.equal(publicOrigin(req({ host: "autre.example" })), "https://sos-maison.fr");
  delete process.env.APP_URL;
});
