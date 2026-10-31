/**
 * Liens de recherche Google pour trouver le matériel proposé (fabriqués par le site, jamais par l'IA).
 */

/** « Joint de siphon 40 mm (environ 3 €) » → « Joint de siphon 40 mm ». */
export function shoppingQuery(item: string): string {
  return item
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(environ|env\.|~|≈|à partir de|de)\s*\d+([.,]\d+)?\s*(à\s*\d+([.,]\d+)?\s*)?(€|euros?)/gi, " ")
    .replace(/\d+([.,]\d+)?\s*(à\s*\d+([.,]\d+)?\s*)?(€|euros?)/gi, " ")
    .replace(/\s*[-–—:,;]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[-–—:,;]$/, "")
    .trim()
    .slice(0, 80);
}

/** Recherche Google Shopping (prix et magasins), en français. */
export function shoppingUrl(item: string): string {
  return `https://www.google.com/search?tbm=shop&hl=fr&gl=fr&q=${encodeURIComponent(shoppingQuery(item))}`;
}

/** Magasins de bricolage autour de l'utilisateur (Google Maps utilise sa position s'il l'autorise). */
export const HARDWARE_STORES_URL = "https://www.google.com/maps/search/magasin+de+bricolage";
