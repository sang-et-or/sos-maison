/**
 * Liens vérifiés : l'assistant ne peut citer QUE des URL renvoyées par l'API
 * de recherche pendant la session. Tout autre lien est retiré avant affichage.
 */

export interface SearchResult {
  url: string;
  title: string;
  description?: string;
  isVideo: boolean;
}

/** Domaines jamais cités (contenus générés, fermes de liens, raccourcisseurs). */
const BLOCKED_HOSTS = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl",
  "pinterest.com", "pinterest.fr", "tiktok.com",
  "facebook.com", "instagram.com",
];

/** Normalise une URL pour comparer (https, sans fragment ni paramètres de suivi, sans / final). */
export function canonicalUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  u.protocol = "https:";
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|ref$|si$|feature$)/.test(key)) u.searchParams.delete(key);
  }
  // youtu.be/ID → youtube.com/watch?v=ID
  if (u.hostname === "youtu.be") {
    const id = u.pathname.slice(1);
    return `https://youtube.com/watch?v=${id}`;
  }
  let s = u.toString();
  if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
  return s;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isBlockedHost(url: string): boolean {
  const h = hostOf(url);
  return BLOCKED_HOSTS.some((b) => h === b || h.endsWith("." + b));
}

export function isVideoUrl(url: string): boolean {
  const h = hostOf(url);
  return h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be" || h === "dailymotion.com" || h === "vimeo.com";
}

/** Filtre et dédoublonne les résultats bruts de l'API de recherche. */
export function filterResults(results: SearchResult[], max = 6): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const c = canonicalUrl(r.url);
    if (!c || !c.startsWith("https://") || isBlockedHost(c) || seen.has(c)) continue;
    seen.add(c);
    out.push({ ...r, url: c, isVideo: r.isVideo || isVideoUrl(c) });
    if (out.length >= max) break;
  }
  return out;
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>()"'\]]+[^\s<>()"'\].,;:!?]/gi;
const MD_LINK = /\[([^\]]{1,200})\]\((https?:\/\/[^\s)]+)\)/gi;

/**
 * Retire de la réponse de l'IA tout lien absent des résultats autorisés.
 * Les liens Markdown non autorisés deviennent leur simple texte ; les URL nues disparaissent.
 */
export function stripUnverifiedLinks(text: string, allowed: Iterable<string>): { text: string; removed: string[] } {
  const ok = new Set<string>();
  for (const a of allowed) {
    const c = canonicalUrl(a);
    if (c) ok.add(c);
  }
  const removed: string[] = [];
  const isOk = (u: string) => {
    const c = canonicalUrl(u);
    return c !== null && ok.has(c);
  };

  let out = text.replace(MD_LINK, (whole, label: string, url: string) => {
    if (isOk(url)) return whole;
    removed.push(url);
    return label;
  });

  // URL nues (hors liens Markdown déjà validés).
  const kept: string[] = [];
  out = out.replace(MD_LINK, (whole) => {
    kept.push(whole);
    return `\u0000${kept.length - 1}\u0000`;
  });
  out = out.replace(URL_IN_TEXT, (url) => {
    if (isOk(url)) return url;
    removed.push(url);
    return "";
  });
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
  return { text: out.replace(/[ \t]{2,}/g, " "), removed };
}
