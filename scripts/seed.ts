/**
 * Données de démonstration pour l'annuaire (développement uniquement).
 * Usage : DATABASE_URL=... npm run db:seed
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant");
if (process.env.NODE_ENV === "production") throw new Error("Pas de données de démonstration en production");
const sql = postgres(url, { max: 1, prepare: false, ssl: false });

const pros = [
  { name: "Démo Plomberie Rhône", city: "Lyon", cp: "69003", codes: ["69003", "69006", "69007"], depts: [], cats: ["plombier"], phone: "04 00 00 00 01" },
  { name: "Démo Élec Services", city: "Villeurbanne", cp: "69100", codes: [], depts: ["69"], cats: ["electricien"], phone: "04 00 00 00 02" },
  { name: "Démo Chauffage Confort", city: "Paris", cp: "75011", codes: [], depts: ["75", "93", "94"], cats: ["chauffagiste", "plombier"], phone: "01 00 00 00 03" },
];

async function main() {
  for (const p of pros) {
    const [row] = await sql<{ id: string }[]>`
      insert into pros (company_name, city, postal_code, service_postal_codes, service_departments, phone, description, status)
      values (${p.name}, ${p.city}, ${p.cp}, ${p.codes}, ${p.depts}, ${p.phone}, 'Fiche de démonstration', 'verified')
      returning id`;
    for (const c of p.cats) await sql`insert into pro_category_links values (${row.id}, ${c})`;
  }
  console.log(`${pros.length} artisans de démonstration ajoutés.`);
  await sql.end();
}
main();
