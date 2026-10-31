"use client";
import { useState } from "react";
import Link from "next/link";
import type { GooglePro } from "@/lib/places/google";

/** Résultats Google affichés dans le site, sous l'annuaire SOS Maison. */
export function GoogleResults(props: { trade: string; tradeName: string; place: string; loggedIn: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<GooglePro[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setState("loading");
    setError(null);
    const res = await fetch(`/api/pros/google?metier=${encodeURIComponent(props.trade)}&lieu=${encodeURIComponent(props.place)}`).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(data?.error ?? "Recherche impossible pour le moment.");
      setState("error");
      return;
    }
    setResults(data.results ?? []);
    setState("done");
  }

  if (!props.loggedIn) {
    return (
      <div className="grid gap-2 rounded-[1.6rem] bg-white p-4">
        <b className="font-display text-[1.05rem]">Plus d&apos;artisans avec Google</b>
        <p className="text-muted">Connectez-vous pour voir les {props.tradeName.toLowerCase()}s trouvés sur Google autour de {props.place}.</p>
        <Link href={`/connexion?next=${encodeURIComponent(`/artisans?cp=${props.place}&metier=${props.trade}`)}`} className="btn-soft">Me connecter</Link>
      </div>
    );
  }

  return (
    <section className="grid gap-3" aria-label="Artisans trouvés sur Google">
      {state === "idle" && (
        <button type="button" onClick={load} className="flex items-center gap-3 rounded-[1.6rem] bg-white px-4 py-3.5 text-left ring-2 ring-line">
          <GoogleMark />
          <span className="flex-1">
            <b className="block font-display text-[1.05rem]">Chercher d&apos;autres {props.tradeName.toLowerCase()}s sur Google</b>
            <small className="text-muted">Autour de {props.place}, sans quitter SOS Maison</small>
          </span>
        </button>
      )}
      {state === "loading" && (
        <p role="status" className="flex items-center gap-2 rounded-[1.6rem] bg-white px-4 py-4 text-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-tangerine border-t-transparent" /> Recherche sur Google…
        </p>
      )}
      {state === "error" && (
        <div role="alert" className="grid gap-2 rounded-2xl bg-danger-50 px-4 py-3 text-danger-700">
          <p>{error}</p>
          <button type="button" onClick={load} className="w-fit font-bold underline">Réessayer</button>
        </div>
      )}
      {state === "done" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="section-title">Trouvés sur Google</h2>
            <span className="flex items-center gap-1.5 text-sm text-muted"><GoogleMark small /> Google</span>
          </div>
          {results.length === 0 ? (
            <p className="rounded-[1.6rem] bg-white p-4 text-muted">Google ne trouve aucun {props.tradeName.toLowerCase()} pour « {props.place} ». Essayez la ville voisine.</p>
          ) : (
            <ul className="grid gap-3">
              {results.map((r) => (
                <li key={r.id} className="grid gap-2.5 rounded-[1.6rem] bg-white p-4">
                  <div className="min-w-0">
                    <b className="block font-display text-[1.08rem] leading-tight">{r.name}</b>
                    <small className="text-muted">{r.address}</small>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.rating !== null && (
                      <span className="badge bg-sun-50 text-sun-700" aria-label={`Note ${r.rating} sur 5, ${r.ratingCount} avis Google`}>
                        ★ {r.rating.toLocaleString("fr-FR")} · {r.ratingCount} avis
                      </span>
                    )}
                    {r.openNow === true && <span className="badge bg-mint-50 text-mint-700">Ouvert maintenant</span>}
                    {r.openNow === false && <span className="badge bg-paper text-muted">Fermé pour l&apos;instant</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {r.phone ? <a href={`tel:${r.phone.replace(/[^0-9+]/g, "")}`} className="btn-primary">Appeler</a> : <span className="btn-soft opacity-60">Pas de numéro</span>}
                    {r.website ? (
                      <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="btn-soft">Site web</a>
                    ) : r.mapsUrl ? (
                      <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-soft">Voir sur la carte</a>
                    ) : null}
                  </div>
                  {r.phone && <p className="-mt-1 text-center text-sm text-muted">{r.phone}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="text-center text-sm text-muted">
            Ces entreprises ne sont pas vérifiées par SOS Maison. Demandez toujours un devis écrit avant l&apos;intervention.
          </p>
        </>
      )}
    </section>
  );
}

function GoogleMark({ small = false }: { small?: boolean }) {
  const s = small ? "h-4 w-4" : "h-9 w-9";
  return (
    <svg viewBox="0 0 48 48" className={`${s} shrink-0`} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
