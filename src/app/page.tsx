import { currentUser } from "@/lib/auth";
import { Starter } from "@/components/Starter";

export default async function Home() {
  const user = await currentUser().catch(() => null);
  return (
    <div className="space-y-8 pt-8">
      <section className="space-y-3 text-center">
        <h1 className="text-[2rem] font-extrabold leading-tight tracking-tight text-brand-900">SOS Maison</h1>
        <p className="text-lg text-slate-600">Votre assistant bricolage intelligent, disponible 24&nbsp;h/24.</p>
      </section>

      <Starter loggedIn={Boolean(user)} />

      <section aria-labelledby="comment" className="space-y-3">
        <h2 id="comment" className="text-lg font-bold text-brand-900">Comment ça marche</h2>
        <ol className="space-y-3">
          {[
            ["Décrivez ou montrez", "Écrivez quelques mots, dictez ou prenez une photo. Pas besoin de connaître le nom des pièces."],
            ["L'assistant vous guide", "Il pose les bonnes questions, explique la réparation étape par étape et vous indique les outils."],
            ["Ou faites appel à un pro", "Si c'est risqué ou si vous préférez, trouvez un artisan près de chez vous."],
          ].map(([t, d], i) => (
            <li key={t} className="card flex gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold text-brand-900">{t}</p>
                <p className="text-slate-600">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card border-l-4 border-danger-600 bg-danger-50">
        <p className="font-semibold text-danger-700">Odeur de gaz, fumée, étincelles&nbsp;?</p>
        <p className="text-slate-700">
          Sortez du logement et appelez le <a href="tel:112" className="font-bold underline">112</a> ou l&apos;urgence gaz au{" "}
          <a href="tel:0800473333" className="font-bold underline">0&nbsp;800&nbsp;47&nbsp;33&nbsp;33</a>.
        </p>
      </section>

      <p className="text-center text-slate-500">100 crédits offerts à l&apos;inscription · Premium 2,99&nbsp;€/mois</p>
    </div>
  );
}
