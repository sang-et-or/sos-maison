import "server-only";
import { filterResults, type SearchResult } from "./links";

/**
 * Recherche de tutoriels via l'API Brave Search (web + vidéos), en français.
 * Retourne au plus 6 résultats filtrés et dédoublonnés.
 */
export async function searchTutorials(query: string): Promise<SearchResult[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error("BRAVE_API_KEY manquant");

  const params = new URLSearchParams({
    q: query.slice(0, 380),
    country: "FR",
    search_lang: "fr",
    ui_lang: "fr-FR",
    count: "10",
    safesearch: "strict",
    result_filter: "web,videos",
  });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Recherche indisponible (${res.status})`);
  const data = (await res.json()) as {
    web?: { results?: Array<{ url: string; title: string; description?: string }> };
    videos?: { results?: Array<{ url: string; title: string; description?: string }> };
  };

  const strip = (s?: string) => (s ?? "").replace(/<[^>]+>/g, "").slice(0, 300);
  const web = (data.web?.results ?? []).map((r) => ({ url: r.url, title: strip(r.title), description: strip(r.description), isVideo: false }));
  const videos = (data.videos?.results ?? []).map((r) => ({ url: r.url, title: strip(r.title), description: strip(r.description), isVideo: true }));
  // Alterne guides écrits et vidéos pour avoir les deux.
  const mixed: SearchResult[] = [];
  for (let i = 0; i < Math.max(web.length, videos.length); i++) {
    if (web[i]) mixed.push(web[i]);
    if (videos[i]) mixed.push(videos[i]);
  }
  return filterResults(mixed, 6);
}
