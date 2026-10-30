import "server-only";
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: postgres.Sql | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    // Le pooler Supabase (mode transaction) ne supporte pas les requêtes préparées.
    prepare: false,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
  });
}

/** Connexion partagée (réutilisée entre les rechargements en développement). */
export const sql: postgres.Sql = globalThis.__sql ?? (globalThis.__sql = create());

/** Lecture d'un réglage de la table settings, avec valeur par défaut. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await sql<{ value: T }[]>`select value from settings where key = ${key}`;
  return rows[0]?.value ?? fallback;
}
