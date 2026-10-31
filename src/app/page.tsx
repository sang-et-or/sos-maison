import { currentUser } from "@/lib/auth";
import Link from "next/link";
import { Starter } from "@/components/Starter";
import { InstallCard } from "@/components/InstallApp";
import { SEASONS, seasonOf, guideById } from "@/lib/guides";

const STEPS = [
  { t: "Vous décrivez ou montrez", d: "Pas besoin de connaître le nom des pièces.", c: "bg-sky-50 text-sky" },
  { t: "Toit-Toit diagnostique", d: "Il pose les bonnes questions et regarde vos photos.", c: "bg-tangerine-50 text-tangerine-dark" },
  { t: "Vous réparez, étape par étape", d: "Ou vous appelez un pro si c'est plus sûr.", c: "bg-mint-50 text-mint-700" },
];

export default async function Home() {
  const user = await currentUser().catch(() => null);
  const season = SEASONS[seasonOf()];
  return (
    <div className="space-y-6 pt-3">
      <Starter loggedIn={Boolean(user)} />

      <section className="space-y-3">
        <h2 className="section-title">Comment ça marche</h2>
        <ol className="space-y-2.5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="grid grid-cols-[2.75rem_1fr] items-center gap-3 rounded-3xl bg-white px-3.5 py-3">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl font-display text-xl font-extrabold ${s.c}`}>{i + 1}</span>
              <span>
                <b className="block font-display text-[1.05rem]">{s.t}</b>
                <span className="text-[0.95rem] text-muted">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2.5 rounded-[1.8rem] p-4" style={{ background: season.bg }}>
        <div className="flex items-center justify-between">
          <h2 className="section-title">{season.n}</h2>
          <Link href="/guides" className="text-sm font-bold underline">Tous les guides</Link>
        </div>
        <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {season.items.map(([label, id]) => {
            const g = guideById(id);
            return (
              <li key={label} className="w-40 shrink-0">
                <Link href={`/guides/${id}`} className="flex h-full flex-col gap-1.5 rounded-3xl bg-white p-3">
                  <span className="text-2xl" aria-hidden>{g?.e}</span>
                  <b className="text-[0.95rem] leading-tight">{label}</b>
                  {g && <small className="text-muted">{g.min} min</small>}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <InstallCard />

      <section className="grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-3xl bg-danger-600 px-4 py-3.5 text-white">
        <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden><circle cx="20" cy="20" r="20" fill="#fff" /><path d="M20 10v13" stroke="#d62839" strokeWidth="4" strokeLinecap="round" /><circle cx="20" cy="29" r="2.6" fill="#d62839" /></svg>
        <p>
          <b className="font-display">Odeur de gaz, fumée, étincelles&nbsp;?</b>
          <br />
          Sortez et appelez le <a href="tel:112" className="font-bold underline">112</a> ou l&apos;urgence gaz au{" "}
          <a href="tel:0800473333" className="whitespace-nowrap font-bold underline">0&nbsp;800&nbsp;47&nbsp;33&nbsp;33</a>.
        </p>
      </section>

      <p className="text-center text-muted">
        <b className="text-ink">100 crédits offerts</b> à l&apos;inscription · Premium 2,99&nbsp;€/mois
      </p>
    </div>
  );
}
