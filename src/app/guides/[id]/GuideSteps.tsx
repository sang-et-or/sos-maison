"use client";
import { useEffect, useState } from "react";

interface Step { t: string; x: string; astuce?: string; svg?: string }

/** Étapes à cocher ; la progression est gardée sur l'appareil. */
export function GuideSteps({ guideId, steps }: { guideId: string; steps: Step[] }) {
  const key = `sm-guide-${guideId}`;
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (Array.isArray(v)) setDone(v.filter((n) => Number.isInteger(n)));
    } catch { /* stockage indisponible */ }
  }, [key]);
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((n) => n !== i) : [...done, i];
    setDone(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignoré */ }
  };
  const all = done.length === steps.length;

  return (
    <section className="space-y-2.5" aria-labelledby="etapes">
      <div className="flex items-center justify-between">
        <h2 id="etapes" className="section-title">Étape par étape</h2>
        <span className="badge bg-mint-50 text-mint-700">{done.length}/{steps.length}</span>
      </div>
      <ol className="space-y-2.5">
        {steps.map((s, i) => {
          const ok = done.includes(i);
          return (
            <li key={i} className={`rounded-3xl bg-white p-4 ring-2 ${ok ? "ring-mint" : "ring-transparent"}`}>
              <button type="button" onClick={() => toggle(i)} aria-pressed={ok}
                      className="grid w-full grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3 text-left">
                <span className={`grid h-9 w-9 place-items-center rounded-xl font-display font-extrabold ${ok ? "bg-mint text-white" : "bg-paper"}`}>
                  {ok ? "✓" : i + 1}
                </span>
                <span>
                  <b className={`block font-display ${ok ? "text-muted line-through" : ""}`}>{s.t}</b>
                  <span className="mt-0.5 block text-[0.98rem]">{s.x}</span>
                </span>
              </button>
              {s.svg && <div className="mt-3 overflow-hidden rounded-2xl [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: s.svg }} />}
              {s.astuce && <p className="mt-2 rounded-2xl bg-sky-50 px-3 py-2 text-[0.95rem]"><b>Astuce&nbsp;: </b>{s.astuce}</p>}
            </li>
          );
        })}
      </ol>
      {all && <p role="status" className="animate-pop rounded-3xl bg-mint px-4 py-3 text-center font-bold text-white">Bravo, c&apos;est fait&nbsp;! 🎉</p>}
    </section>
  );
}
