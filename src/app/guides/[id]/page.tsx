import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, ILLUSTRATIONS, guideById } from "@/lib/guides";
import { GuideSteps } from "./GuideSteps";
import { HARDWARE_STORES_URL, shoppingUrl } from "@/lib/shopping";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const g = guideById((await params).id);
  return { title: g ? `${g.t} — SOS Maison` : "Guide — SOS Maison", description: g?.d };
}

/** Les schémas sont des dessins originaux SOS Maison (SVG statique, aucun contenu utilisateur). */
function Ill({ name }: { name: string }) {
  const svg = ILLUSTRATIONS[name];
  if (!svg) return null;
  return <div className="overflow-hidden rounded-2xl [&_svg]:h-auto [&_svg]:w-full [&_text]:[font-family:var(--font-body)]" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const g = guideById((await params).id);
  if (!g) notFound();
  const forPro = /pro/i.test(g.niveau) && !/si/i.test(g.niveau);

  return (
    <article className="space-y-5 pt-3">
      <Link href="/guides" className="text-[0.95rem] font-bold text-muted">‹ Tous les guides</Link>
      <header className="space-y-3 rounded-[1.8rem] p-5" style={{ background: g.bg }}>
        <span className="text-4xl" aria-hidden>{g.e}</span>
        <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight">{g.t}</h1>
        <p>{g.d}</p>
        <div className="flex flex-wrap gap-2">
          <span className="badge bg-white">⏱ {g.min} min</span>
          <span className={`badge ${forPro ? "bg-danger-50 text-danger-700" : "bg-white"}`}>{g.niveau}</span>
          <span className="badge bg-white">💶 {g.cout}</span>
        </div>
      </header>

      <Ill name={g.ill} />

      <section className="grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-3xl bg-white p-4"><b className="font-display">Pourquoi</b><p className="mt-1 text-[0.98rem]">{g.pourquoi}</p></div>
        <div className="rounded-3xl bg-white p-4"><b className="font-display">Quand</b><p className="mt-1 text-[0.98rem]">{g.quand}</p></div>
      </section>

      <p className="rounded-3xl bg-tangerine-50 px-4 py-3"><b>Sécurité&nbsp;: </b>{g.secu}</p>

      {g.outils.length > 0 && (
        <section className="rounded-3xl bg-white p-4">
          <h2 className="section-title text-lg">Matériel</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {g.outils.map((o) => (
              <li key={o}>
                <a href={shoppingUrl(o)} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Chercher « ${o} » sur Google Shopping`}
                   className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1.5 text-[0.92rem] font-bold hover:bg-sun-50">🛒 {o}</a>
              </li>
            ))}
          </ul>
          <a href={HARDWARE_STORES_URL} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-[0.92rem] font-bold text-sky-700 underline">
            📍 Magasins de bricolage près de chez moi
          </a>
        </section>
      )}

      <GuideSteps guideId={g.id} steps={g.s.map((s) => ({ ...s, svg: s.img && s.img !== g.ill ? ILLUSTRATIONS[s.img] : undefined }))} />

      {g.erreurs.length > 0 && (
        <section className="rounded-3xl bg-white p-4">
          <h2 className="section-title text-lg">Erreurs à éviter</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">{g.erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
        </section>
      )}

      {g.pro.length > 0 && (
        <section className="space-y-2 rounded-3xl bg-sun-50 p-4">
          <h2 className="section-title text-lg">Quand appeler un pro</h2>
          <ul className="list-disc space-y-1 pl-5">{g.pro.map((e) => <li key={e}>{e}</li>)}</ul>
          <Link href="/artisans" className="btn-ink w-full">Trouver un artisan</Link>
        </section>
      )}

      <Link href="/depannage/nouveau" className="btn-primary w-full">Ça ne marche pas&nbsp;? Demander à Toit-Toit</Link>

      {g.sources.length > 0 && (
        <section className="text-[0.92rem] text-muted">
          <h2 className="font-bold text-ink">Sources consultées</h2>
          <ul className="mt-1 space-y-1">
            {g.sources.map(([t, u]) => (
              <li key={u}><a href={u} target="_blank" rel="noopener noreferrer nofollow" className="underline">{t}</a></li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
