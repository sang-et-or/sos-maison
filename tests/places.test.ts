import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuery, normalizePlaces } from "../src/lib/places/google";

test("requête Google par métier et lieu", () => {
  assert.deepEqual(buildQuery("plombier", "69006"), { textQuery: "plombier 69006", includedType: "plumber" });
  assert.equal(buildQuery("chauffagiste", "Lyon").includedType, undefined);
  assert.match(buildQuery("inconnu", "Lyon").textQuery, /multiservices/);
});

test("réponse Google nettoyée", () => {
  const out = normalizePlaces({
    places: [
      { id: "a", displayName: { text: "Plomberie Martin" }, formattedAddress: "12 Rue X, 69006 Lyon, France", nationalPhoneNumber: "04 78 00 00 00",
        rating: 4.66, userRatingCount: 87, websiteUri: "https://martin.fr", googleMapsUri: "https://maps.google.com/?cid=1",
        currentOpeningHours: { openNow: true }, businessStatus: "OPERATIONAL" },
      { id: "b", displayName: { text: "Fermé définitivement" }, businessStatus: "CLOSED_PERMANENTLY" },
      { id: "c", displayName: { text: "Sans site" }, websiteUri: "http://pas-https.fr" },
      { displayName: { text: "Sans identifiant" } },
    ],
  });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { id: "a", name: "Plomberie Martin", address: "12 Rue X, 69006 Lyon", phone: "04 78 00 00 00", rating: 4.7, ratingCount: 87,
    website: "https://martin.fr", mapsUrl: "https://maps.google.com/?cid=1", openNow: true });
  assert.equal(out[1].website, null);
  assert.equal(out[1].openNow, null);
  assert.deepEqual(normalizePlaces(null), []);
  assert.deepEqual(normalizePlaces({ error: "x" }), []);
});
