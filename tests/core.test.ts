import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyText, combine, tutorialAllowed } from "../src/lib/safety/risk";
import { emergencyGuidance, systemGuardrail } from "../src/lib/safety/emergency";
import { canonicalUrl, filterResults, stripUnverifiedLinks } from "../src/lib/search/links";
import { decide, realtimeMinutesAllowed } from "../src/lib/credits/policy";

// ---------------------------------------------------------------- Sécurité
const cases: Array<[string, number, string?]> = [
  ["Ça sent le gaz dans la cuisine", 4, "gas"],
  ["J'ai une odeur de gaz depuis ce matin", 4, "gas"],
  ["il y a de la fumée qui sort du lave-linge", 4, "fire"],
  ["La prise a fondu et j'ai vu des étincelles", 4, "electric_shock"],
  ["Le détecteur de CO sonne", 4, "carbon_monoxide"],
  ["J'ai mal à la tête depuis qu'on a rallumé la chaudière", 4, "carbon_monoxide"],
  ["De l'eau coule sur la prise du salon", 4, "flood_electric"],
  ["Le plafond de la salle de bain bombe et s'affaisse", 4, "structure"],
  ["Ma chaudière affiche le code F28", 3, "gas_appliance"],
  ["Je voudrais abattre un mur porteur", 3, "structure"],
  ["Il y a un fil dénudé derrière le meuble", 3, "electrical_panel"],
  ["Ça ne sent pas le gaz mais la gazinière ne s'allume plus", 3, "gas_appliance"],
  ["Comment changer une prise électrique ?", 2, "mains_wiring"],
  ["Mon cumulus ne chauffe plus", 2, "mains_wiring"],
  ["Je dois nettoyer la gouttière", 2, "height"],
  ["Ma chasse d'eau coule en permanence", 1, "water"],
  ["Le lave-vaisselle ne vidange pas", 1, "appliance"],
  ["Comment purger un radiateur ?", 1, "water"],
  ["Je veux fixer une étagère dans le placo", 0],
  ["La poignée de la porte du placard est desserrée", 0],
];

for (const [text, level, hazard] of cases) {
  test(`risque ${level} : ${text}`, () => {
    const r = classifyText(text);
    assert.equal(r.level, level, JSON.stringify(r));
    if (hazard) assert.ok(r.hazards.includes(hazard as never), JSON.stringify(r));
  });
}

test("négation : « pas d'odeur de gaz » ne déclenche pas l'écran d'urgence mais bloque le tutoriel", () => {
  const r = classifyText("Il n'y a pas d'odeur de gaz, c'est juste le four qui fait du bruit");
  assert.equal(r.level, 3);
  assert.equal(tutorialAllowed(r.level), false);
});

test("le métier proposé suit le danger le plus grave", () => {
  assert.equal(classifyText("Odeur de gaz près de la chaudière").pro, "chauffagiste");
  assert.equal(classifyText("Le robinet fuit").pro, "plombier");
});

test("combine garde toujours le niveau le plus élevé", () => {
  const rules = classifyText("robinet qui goutte");
  const ai = { level: 3 as const, hazards: ["gas_appliance" as const], pro: "chauffagiste" };
  const r = combine(rules, ai);
  assert.equal(r.level, 3);
  assert.equal(r.pro, "chauffagiste");
  assert.deepEqual(new Set(r.hazards), new Set(["water", "gas_appliance"]));
});

test("chaque urgence a des consignes et des numéros", () => {
  for (const h of ["gas", "fire", "electric_shock", "carbon_monoxide", "flood_electric", "structure", "injury"] as const) {
    const [g] = emergencyGuidance([h]);
    assert.ok(g && g.steps.length >= 2 && g.numbers.length >= 1, h);
  }
  assert.match(emergencyGuidance(["gas"])[0].numbers[0].display, /0 800 47 33 33/);
  assert.match(systemGuardrail(4), /AUCUNE/);
  assert.match(systemGuardrail(3), /AUCUN tutoriel/);
});

// ---------------------------------------------------------------- Liens
test("canonicalUrl normalise", () => {
  assert.equal(canonicalUrl("http://www.Leroymerlin.fr/conseils/x/?utm_source=a#top"), "https://leroymerlin.fr/conseils/x");
  assert.equal(canonicalUrl("https://youtu.be/abc123?si=xyz"), "https://youtube.com/watch?v=abc123");
  assert.equal(canonicalUrl("javascript:alert(1)"), null);
  assert.equal(canonicalUrl("pas une url"), null);
});

test("filterResults retire doublons, http seul transformé, domaines bloqués", () => {
  const out = filterResults([
    { url: "https://www.example.fr/a", title: "A", isVideo: false },
    { url: "https://example.fr/a/", title: "A bis", isVideo: false },
    { url: "https://bit.ly/xyz", title: "court", isVideo: false },
    { url: "https://www.youtube.com/watch?v=1", title: "vidéo", isVideo: false },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[1].isVideo, true);
});

test("stripUnverifiedLinks supprime les liens inventés et garde les autorisés", () => {
  const allowed = ["https://www.example.fr/tuto", "https://youtube.com/watch?v=ok"];
  const reply =
    "Voir [ce guide](https://example.fr/tuto?utm_source=x) et [cette vidéo](https://youtube.com/watch?v=FAUX). " +
    "Aussi https://site-invente.fr/page. Et https://youtu.be/ok.";
  const { text, removed } = stripUnverifiedLinks(reply, allowed);
  assert.match(text, /\[ce guide\]\(https:\/\/example\.fr\/tuto\?utm_source=x\)/);
  assert.match(text, /cette vidéo(?!\])/);
  assert.doesNotMatch(text, /FAUX|site-invente/);
  assert.match(text, /youtu\.be\/ok/);
  assert.equal(removed.length, 2);
});

// ---------------------------------------------------------------- Crédits
test("compte gratuit : débit et refus", () => {
  const ok = decide("photo", 1, { premium: false, balance: 10, monthUsage: 0 });
  assert.deepEqual(ok, { allowed: true, credits: 3 });
  const no = decide("video_minute", 2, { premium: false, balance: 15, monthUsage: 0 });
  assert.equal(no.allowed, false);
  assert.equal(!no.allowed && no.reason, "insufficient_credits");
});

test("premium : aucun crédit, avertissement à 80 %, blocage au plafond", () => {
  assert.deepEqual(decide("message", 1, { premium: true, balance: 0, monthUsage: 999 }), { allowed: true, credits: 0 });
  const warn = decide("video_minute", 1, { premium: true, balance: 0, monthUsage: 7 });
  assert.ok(warn.allowed && warn.warning);
  const cap = decide("video_minute", 2, { premium: true, balance: 0, monthUsage: 9 });
  assert.equal(cap.allowed, false);
  const repairs = decide("message", 1, { premium: true, balance: 0, monthUsage: 0, monthRepairs: 20, createsRepair: true });
  assert.equal(repairs.allowed, false);
});

test("durée autorisée d'une session vidéo", () => {
  assert.equal(realtimeMinutesAllowed("video_minute", { premium: false, balance: 100, monthUsage: 0 }, 5), 5);
  assert.equal(realtimeMinutesAllowed("video_minute", { premium: false, balance: 25, monthUsage: 0 }, 5), 2);
  assert.equal(realtimeMinutesAllowed("video_minute", { premium: true, balance: 0, monthUsage: 8.5 }, 5), 1);
  assert.equal(realtimeMinutesAllowed("voice_minute", { premium: true, balance: 0, monthUsage: 25 }, 10), 0);
});
