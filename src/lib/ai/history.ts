/**
 * Construit l'historique envoyé à l'IA : textes, fiches résumées et photos.
 * Les photos les plus récentes (jusqu'à MAX_IMAGES) sont renvoyées à chaque tour, sinon l'IA
 * « oublie » une photo vue au message précédent ; les plus anciennes sont signalées par une note.
 */
export const MAX_IMAGES = 4;

export interface HistoryMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  card: { titre: string; etapes: string[] } | null;
  card_done: number[];
}
export interface HistoryPhoto {
  id: string;
  message_id: number;
  mime_type: string;
  base64: string;
}
type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } };
export interface Turn {
  role: "user" | "assistant";
  content: string | Block[];
}

const textOf = (m: HistoryMessage) =>
  m.card
    ? `${m.content}\n\n[Fiche affichée « ${m.card.titre} » : ${m.card.etapes.map((e, i) => `${i + 1}. ${e}`).join(" ")} — étapes cochées par l'utilisateur : ${m.card_done.length}/${m.card.etapes.length}]`.trim()
    : m.content;

export function buildTurns(history: HistoryMessage[], photos: HistoryPhoto[], currentMessageId: number): Turn[] {
  // Photos gardées : les plus récentes, en priorité celles du message courant.
  const sorted = [...photos].sort((a, b) => b.message_id - a.message_id);
  const kept = new Set(sorted.slice(0, MAX_IMAGES).map((p) => p.id));
  const turns: Turn[] = [];

  for (const m of history) {
    if (m.role === "system") continue;
    const mine = photos.filter((p) => p.message_id === m.id);
    const shown = mine.filter((p) => kept.has(p.id));
    let text = textOf(m);
    if (m.role === "user" && mine.length) {
      const n = mine.length;
      text +=
        shown.length === n
          ? `\n\n[${n} photo${n > 1 ? "s" : ""} jointe${n > 1 ? "s" : ""} à ce message par l'utilisateur${m.id === currentMessageId ? "" : " (déjà envoyée" + (n > 1 ? "s" : "") + " plus tôt dans la conversation)"}]`
          : `\n\n[L'utilisateur avait joint ${n} photo${n > 1 ? "s" : ""} ici ; ${shown.length ? "seules les plus récentes sont renvoyées" : "elles ne sont plus renvoyées"}. Tes observations faites à ce moment-là restent valables.]`;
    }
    const blocks: Block[] = shown.map((p) => ({
      type: "image",
      source: { type: "base64", media_type: p.mime_type as "image/jpeg" | "image/png" | "image/webp", data: p.base64 },
    }));

    const prev = turns.at(-1);
    if (prev && prev.role === m.role) {
      // L'API exige l'alternance des rôles : on fusionne deux messages consécutifs du même rôle.
      if (!blocks.length && typeof prev.content === "string") prev.content += "\n\n" + text;
      else {
        const base: Block[] = typeof prev.content === "string" ? [{ type: "text", text: prev.content }] : prev.content;
        prev.content = [...base, ...blocks, { type: "text", text }];
      }
    } else {
      turns.push({ role: m.role, content: blocks.length ? [...blocks, { type: "text", text }] : text });
    }
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}
