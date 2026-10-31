import Link from "next/link";
import { GUIDES, SEASONS, seasonOf, guideById, type SeasonKey } from "@/lib/guides";

export const metadata = { title: "Guides d'entretien — SOS Maison" };
export const revalidate = 3600;

const ORDER: SeasonKey[] = ["automne", "hiver", "printemps", "ete"];

export default function GuidesPage() {
  const now = seasonOf();
  const season = SEASONS[now];
  return (
    <div className="space-y-6 pt-3">
      <div>
        <h1 className="font-display text-[1.8rem] font-extrabold leading-tight tracking-tight">Guides d&apos;entretien</h1>
        <p className="text-muted">Pas à pas, illustrés, avec les erreurs à éviter et le moment où appeler un pro.</p>
      </div>

      <section className="space-y-3 rounded-[1.8rem] p-5" style={{ background: season.bg }} aria-labelledby="saison">
        <h2 id="saison" className="section-title">{season.n}, à faire chez vous</h2>
        <ul className="space-y-2">
          {season.items.map(([label, id, note]) => {
            const g = guideById(id);
            return (
              <li key={label}>
                <Link href={`/guides/${id}`} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white/90 px-3 py-2.5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl text-xl" style={{ background: g?.bg }} aria-hidden>{g?.e}</span>
                  <b className="min-w-0">{label}</b>
                  {note ? <span className="badge bg-sun-50 text-sun-700">{note}</span> : <span className="text-muted" aria-hidden>›</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Tous les guides</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {GUIDES.map((g) => (
            <li key={g.id}>
              <Link href={`/guides/${g.id}`} className="flex h-full flex-col gap-1.5 rounded-3xl bg-white p-3.5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl text-2xl" style={{ background: g.bg }} aria-hidden>{g.e}</span>
                <b className="font-display leading-tight">{g.t}</b>
                <small className="text-muted">{g.min} min · {g.niveau}</small>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Autres saisons">
        {ORDER.filter((k) => k !== now).map((k) => (
          <details key={k} className="w-full rounded-3xl bg-white px-4 py-3">
            <summary className="cursor-pointer font-bold">{SEASONS[k].n}</summary>
            <ul className="mt-2 space-y-1.5">
              {SEASONS[k].items.map(([label, id]) => (
                <li key={label}><Link href={`/guides/${id}`} className="text-sky-700 underline">{label}</Link></li>
              ))}
            </ul>
          </details>
        ))}
      </nav>
    </div>
  );
}
