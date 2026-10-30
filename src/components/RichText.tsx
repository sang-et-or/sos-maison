import { Fragment } from "react";

export interface Source {
  url: string;
  title: string;
  isVideo: boolean;
}

/**
 * Affiche la réponse de l'assistant (Markdown simple : paragraphes, listes, gras)
 * sans jamais injecter de HTML. Les renvois [n] deviennent des liens vers les sources vérifiées.
 */
export function RichText({ text, sources = [] }: { text: string; sources?: Source[] }) {
  const blocks: Array<{ kind: "p" | "ol" | "ul"; lines: string[] }> = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const kind = ol ? "ol" : ul ? "ul" : line.trim() ? "p" : null;
    const content = ol?.[1] ?? ul?.[1] ?? line.replace(/^#{1,6}\s+/, "");
    if (!kind) {
      blocks.push({ kind: "p", lines: [] });
      continue;
    }
    const last = blocks.at(-1);
    if (last && last.kind === kind && (kind !== "p" || last.lines.length > 0)) last.lines.push(content);
    else blocks.push({ kind, lines: [content] });
  }

  return (
    <div className="prose-chat">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.kind === "p" ? (
            <p key={i}>{b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, sources)}</Fragment>)}</p>
          ) : b.kind === "ol" ? (
            <ol key={i}>{b.lines.map((l, j) => <li key={j}>{inline(l, sources)}</li>)}</ol>
          ) : (
            <ul key={i}>{b.lines.map((l, j) => <li key={j}>{inline(l, sources)}</li>)}</ul>
          ),
        )}
    </div>
  );
}

function inline(text: string, sources: Source[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[(\d{1,2})\]|\[([^\]]{1,200})\]\((https:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2]) {
      const s = sources[Number(m[2]) - 1];
      out.push(
        s ? (
          <a key={k++} href={s.url} target="_blank" rel="noopener noreferrer nofollow"
             className="mx-0.5 inline-grid h-6 min-w-6 place-items-center rounded-full bg-brand-100 px-1.5 align-baseline text-sm font-semibold text-brand-700"
             aria-label={`Source ${m[2]} : ${s.title}`}>
            {m[2]}
          </a>
        ) : (
          m[0]
        ),
      );
    } else if (m[3] && m[4]) {
      // Seuls les liens déjà vérifiés côté serveur arrivent jusqu'ici.
      out.push(<a key={k++} href={m[4]} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand-600 underline">{m[3]}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <ol className="mt-3 space-y-2">
      {sources.map((s, i) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noopener noreferrer nofollow"
             className="flex items-start gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 hover:bg-brand-50">
            <span className="mt-0.5 grid h-6 min-w-6 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{i + 1}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-brand-900">{s.isVideo ? "▶ " : ""}{s.title}</span>
              <span className="block truncate text-sm text-slate-500">{new URL(s.url).hostname.replace(/^www\./, "")}</span>
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}
