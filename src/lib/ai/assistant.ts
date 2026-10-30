import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS, tokenCostUsd, BRAVE_COST_PER_QUERY_USD } from "./cost";
import { systemFor, CLASSIFIER_SYSTEM } from "./prompt";
import type { Hazard, RiskLevel, RiskResult } from "../safety/risk";
import { tutorialAllowed } from "../safety/risk";
import { searchTutorials } from "../search/brave";
import { stripUnverifiedLinks, type SearchResult } from "../search/links";
import { chargeOrThrow, recordUsage } from "../usage";
import { HttpError } from "../auth";

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquant");
  return (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 }));
}

const HAZARDS = new Set<Hazard>([
  "gas", "fire", "electric_shock", "carbon_monoxide", "flood_electric", "structure", "injury",
  "gas_appliance", "electrical_panel", "asbestos", "height", "chemical", "mains_wiring", "water", "appliance",
]);

/** Deuxième avis sur le risque, par un modèle rapide. En cas d'échec : aucun avis (les règles restent appliquées). */
export async function classifyWithAI(
  text: string,
  meta: { userId: string; repairId: string },
): Promise<RiskResult | undefined> {
  try {
    const res = await anthropic().messages.create({
      model: MODELS.fast,
      max_tokens: 120,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: text.slice(0, 4000) }],
    });
    await recordUsage({
      userId: meta.userId, repairId: meta.repairId, kind: "classifier", provider: "anthropic",
      model: MODELS.fast, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens,
      costUsd: tokenCostUsd(MODELS.fast, res.usage),
    });
    const raw = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {
      level?: number; hazards?: string[]; pro?: string | null;
    };
    const level = Math.max(0, Math.min(4, Math.round(Number(json.level ?? 0)))) as RiskLevel;
    const hazards = (json.hazards ?? []).filter((h): h is Hazard => HAZARDS.has(h as Hazard));
    return { level, hazards, pro: json.pro ?? undefined };
  } catch (e) {
    console.warn("Classificateur IA indisponible", e);
    return undefined;
  }
}

export type AssistantEvent =
  | { type: "delta"; text: string }
  | { type: "status"; text: string }
  | { type: "sources"; sources: SearchResult[] }
  | { type: "notice"; text: string }
  | { type: "final"; text: string; sources: SearchResult[] };

export interface ChatTurn {
  role: "user" | "assistant";
  content: Anthropic.MessageParam["content"];
}

const SEARCH_TOOL: Anthropic.Tool = {
  name: "rechercher_tutoriels",
  description:
    "Recherche sur Internet des tutoriels, guides de fabricants et vidéos en français pour un problème domestique précis. Renvoie des résultats numérotés à citer avec [n].",
  input_schema: {
    type: "object",
    properties: {
      requete: { type: "string", description: "Requête précise en français, avec marque et modèle si connus." },
    },
    required: ["requete"],
  },
};

const MAX_SEARCHES = 2;

/**
 * Fait répondre l'assistant en streaming. Gère la recherche de tutoriels
 * (débitée comme une action), puis renvoie le texte final nettoyé de tout lien non vérifié.
 */
export async function* runAssistant(opts: {
  userId: string;
  repairId: string;
  turns: ChatTurn[];
  risk: RiskLevel;
  premium: boolean;
  equipment?: string;
}): AsyncGenerator<AssistantEvent> {
  const messages: Anthropic.MessageParam[] = opts.turns.map((t) => ({ role: t.role, content: t.content }));
  const sources: SearchResult[] = [];
  const tools = tutorialAllowed(opts.risk) || opts.risk === 2 ? [SEARCH_TOOL] : [];
  let searches = 0;
  let text = "";

  for (let round = 0; round < MAX_SEARCHES + 1; round++) {
    const stream = anthropic().messages.stream({
      model: MODELS.chat,
      max_tokens: 1200,
      system: systemFor(opts.risk, { premium: opts.premium, equipment: opts.equipment }),
      tools: tools.length && searches < MAX_SEARCHES ? tools : undefined,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
        yield { type: "delta", text: event.delta.text };
      }
    }
    const msg = await stream.finalMessage();
    await recordUsage({
      userId: opts.userId, repairId: opts.repairId, kind: "message", provider: "anthropic", model: MODELS.chat,
      inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
      cachedTokens: msg.usage.cache_read_input_tokens ?? 0,
      costUsd: tokenCostUsd(MODELS.chat, msg.usage),
    });

    const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (msg.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: msg.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const query = String((tu.input as { requete?: string }).requete ?? "").trim();
      let content: string;
      try {
        if (!query) throw new Error("requête vide");
        await chargeOrThrow({ userId: opts.userId, kind: "search", repairId: opts.repairId });
        searches++;
        yield { type: "status", text: "Je cherche des tutoriels fiables…" };
        const found = await searchTutorials(query);
        await recordUsage({
          userId: opts.userId, repairId: opts.repairId, kind: "search", provider: "brave",
          costUsd: BRAVE_COST_PER_QUERY_USD,
        });
        const start = sources.length;
        sources.push(...found);
        content = found.length
          ? found
              .map((r, i) => `[${start + i + 1}] ${r.isVideo ? "(vidéo) " : ""}${r.title} — ${r.description ?? ""}`)
              .join("\n")
          : "Aucun résultat fiable trouvé. Explique toi-même les étapes.";
        if (found.length) yield { type: "sources", sources: [...sources] };
      } catch (e) {
        content =
          e instanceof HttpError && e.status === 402
            ? "Recherche impossible : crédits ou limite mensuelle atteints. Réponds sans recherche."
            : "Recherche momentanément indisponible. Réponds sans recherche.";
        if (e instanceof HttpError && e.status === 402) yield { type: "notice", text: e.message };
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content });
    }
    messages.push({ role: "user", content: results });
    if (text && !text.endsWith("\n")) {
      text += "\n\n";
      yield { type: "delta", text: "\n\n" };
    }
  }

  // Les numéros [n] désignent les résultats ; toute adresse web écrite par le modèle est retirée.
  const clean = stripUnverifiedLinks(text, sources.map((s) => s.url)).text.trim();
  yield { type: "final", text: clean, sources };
}
