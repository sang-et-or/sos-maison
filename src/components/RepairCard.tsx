"use client";
import { useState } from "react";
import type { RepairCard as Card } from "@/lib/ai/card";
import { formatCost, formatDuration } from "@/lib/ai/card";
import { HARDWARE_STORES_URL, shoppingUrl } from "@/lib/shopping";
import type { Source } from "./RichText";

/** Fiche de réparation : diagnostic, outils, sécurité, étapes à cocher avec progression. */
export function RepairCard(props: {
  card: Card;
  messageId: number | null;
  initialDone: number[];
  sources: Source[];
  onProgress?: (done: number, total: number) => void;
}) {
  const { card } = props;
  const [done, setDone] = useState<number[]>(props.initialDone);
  const total = card.etapes.length;
  const pct = Math.round((100 * done.length) / total);
  const duration = formatDuration(card.duree_minutes);
  const cost = formatCost(card);

  async function toggle(i: number) {
    const on = !done.includes(i);
    const next = on ? [...done, i].sort((a, b) => a - b) : done.filter((x) => x !== i);
    setDone(next);
    props.onProgress?.(next.length, total);
    if (props.messageId === null) return;
    const res = await fetch(`/api/messages/${props.messageId}/steps`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: i, done: on }),
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setDone(data.done);
    }
  }

  return (
    <section aria-label={`Fiche de réparation : ${card.titre}`}
             className="grid animate-pop gap-3 rounded-[1.6rem] border-2 border-ink bg-white p-4 shadow-chunky">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[1.15rem] font-extrabold leading-tight">{card.titre}</h3>
        <span className="shrink-0 text-[0.9rem] font-bold tabular-nums text-muted">{done.length}/{total}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement">
        <i className="block h-full rounded-full bg-mint transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <p className="grid grid-cols-[1.75rem_1fr] items-start gap-2 rounded-2xl bg-sky-50 px-3 py-2.5 text-[0.95rem]">
        <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden><circle cx="12" cy="12" r="8" fill="none" stroke="#3d7bff" strokeWidth="3" /><path d="m18 18 6 6" stroke="#3d7bff" strokeWidth="3" strokeLinecap="round" /></svg>
        <span><b>Diagnostic :</b> {card.diagnostic}</span>
      </p>

      {(duration || cost) && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Durée et coût">
          {duration && <li className="badge bg-sky-50 text-sky-700">⏱ {duration}</li>}
          {cost && <li className="badge bg-mint-50 text-mint-700">Pièces : {cost}</li>}
        </ul>
      )}

      {card.outils.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-sun-50 px-3 py-2.5">
          <b className="block text-[0.95rem]">Matériel — touchez pour le trouver</b>
          <ul className="flex flex-wrap gap-1.5" aria-label="Matériel nécessaire">
            {card.outils.map((o) => (
              <li key={o}>
                <a href={shoppingUrl(o)} target="_blank" rel="noopener noreferrer nofollow"
                   aria-label={`Chercher « ${o} » sur Google Shopping`}
                   className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[0.88rem] font-bold text-ink ring-1 ring-sun hover:bg-sun/20">
                  🛒 {o}
                </a>
              </li>
            ))}
          </ul>
          <a href={HARDWARE_STORES_URL} target="_blank" rel="noopener noreferrer nofollow" className="inline-block text-[0.88rem] font-bold text-sky-700 underline">
            📍 Magasins de bricolage près de chez moi
          </a>
        </div>
      )}

      <p className="rounded-2xl bg-tangerine-50 px-3 py-2.5 text-[0.95rem]">
        <b className="text-tangerine-dark">Avant de commencer :</b> {card.securite}
      </p>

      <ol className="grid gap-1">
        {card.etapes.map((step, i) => {
          const checked = done.includes(i);
          return (
            <li key={i}>
              <label className="grid cursor-pointer grid-cols-[2.25rem_1fr] items-start gap-2.5 rounded-2xl p-2 hover:bg-paper">
                <input type="checkbox" className="peer sr-only" checked={checked} onChange={() => toggle(i)} />
                <span aria-hidden className={`grid h-8 w-8 place-items-center rounded-xl border-[2.5px] transition peer-focus-visible:outline peer-focus-visible:outline-4 peer-focus-visible:outline-sky ${checked ? "border-mint bg-mint" : "border-line bg-white"}`}>
                  <svg viewBox="0 0 16 16" className={`h-4 w-4 transition-opacity ${checked ? "opacity-100" : "opacity-0"}`}><path d="M3 8.5l3 3 7-7" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span className={checked ? "text-muted line-through decoration-muted/50" : ""}>
                  <span className="sr-only">Étape {i + 1} : </span>
                  {renderCites(step, props.sources)}
                </span>
              </label>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function renderCites(text: string, sources: Source[]) {
  const parts = text.split(/(\[\d{1,2}\])/g);
  return parts.map((p, i) => {
    const m = /^\[(\d{1,2})\]$/.exec(p);
    const s = m ? sources[Number(m[1]) - 1] : undefined;
    return s ? (
      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer nofollow"
         className="mx-0.5 inline-grid h-[1.4rem] min-w-[1.4rem] place-items-center rounded-lg bg-sky px-1 align-baseline text-[0.78rem] font-bold text-white"
         aria-label={`Source ${m![1]} : ${s.title}`}>{m![1]}</a>
    ) : (
      p
    );
  });
}

/** Pluie de confettis (désactivée si l'utilisateur préfère moins d'animations). */
export function confetti() {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  c.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  if (!ctx) return c.remove();
  const cols = ["#ff6b2c", "#ffc83d", "#22b8a0", "#3d7bff", "#8b6cff"];
  const parts = Array.from({ length: 120 }, (_, i) => ({
    x: c.width / 2, y: c.height * 0.6,
    vx: (Math.random() - 0.5) * 26 * dpr, vy: (-Math.random() * 30 - 8) * dpr,
    s: (8 + Math.random() * 10) * dpr, col: cols[i % cols.length], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
  }));
  let t = 0;
  const tick = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.vy += 0.9 * dpr; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.col;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (++t < 90) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}
