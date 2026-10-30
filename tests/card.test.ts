import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCard, formatCost, formatDuration } from "../src/lib/ai/card";

test("fiche valide nettoyée et bornée", () => {
  const c = normalizeCard(
    {
      titre: "  Régler   le flotteur  ",
      diagnostic: "Le flotteur est trop haut, voir https://site-invente.fr/x",
      securite: "Fermez le robinet d'arrêt.",
      outils: ["Tournevis plat", "", 42, "Éponge"],
      etapes: ["Repérez la vis [1]", "Tournez d'un tour", "Laissez remplir"],
      duree_minutes: "5",
      cout_min_eur: 0,
      cout_max_eur: -3,
      economie_estimee_eur: 99999,
    },
    ["https://example.fr/guide"],
  );
  assert.ok(c);
  assert.equal(c.titre, "Régler le flotteur");
  assert.doesNotMatch(c.diagnostic, /site-invente/);
  assert.deepEqual(c.outils, ["Tournevis plat", "Éponge"]);
  assert.equal(c.etapes[0], "Repérez la vis [1]");
  assert.equal(c.duree_minutes, 5);
  assert.equal(c.cout_max_eur, 0);
  assert.equal(c.economie_estimee_eur, 2000);
});

test("fiche refusée si incomplète", () => {
  assert.equal(normalizeCard(null), null);
  assert.equal(normalizeCard({ titre: "X", diagnostic: "Y", etapes: ["une seule"] }), null);
  assert.equal(normalizeCard({ diagnostic: "Y", etapes: ["a", "b"] }), null);
});

test("sécurité par défaut, 10 étapes maximum, textes coupés", () => {
  const c = normalizeCard({ titre: "T", diagnostic: "D", etapes: Array.from({ length: 14 }, (_, i) => `Étape ${i} ` + "x".repeat(400)) });
  assert.ok(c);
  assert.equal(c.etapes.length, 10);
  assert.ok(c.etapes[0].length <= 260 && c.etapes[0].endsWith("…"));
  assert.match(c.securite, /doute/);
});

test("formats durée et coût", () => {
  assert.equal(formatDuration(5), "5 min");
  assert.equal(formatDuration(90), "1 h 30");
  assert.equal(formatDuration(120), "2 h");
  assert.equal(formatDuration(undefined), null);
  assert.equal(formatCost({ cout_min_eur: 0, cout_max_eur: 0 }), "0 €");
  assert.equal(formatCost({ cout_min_eur: 5, cout_max_eur: 10 }), "5 à 10 €");
  assert.equal(formatCost({ cout_max_eur: 8 }), "8 €");
  assert.equal(formatCost({}), null);
});
