export const metadata = { title: "Mentions légales — SOS Maison" };

// MODÈLE À COMPLÉTER avant la mise en ligne (champs entre crochets).
export default function Page() {
  return (
    <article className="card prose-chat mt-6 space-y-3">
      <h1 className="text-2xl font-extrabold text-brand-900">Mentions légales</h1>
      <h2 className="font-bold">Éditeur</h2>
      <p>[Nom ou raison sociale] — [forme juridique, capital] — [adresse] — SIRET [numéro] — RCS [ville] — TVA [numéro ou « TVA non applicable, art. 293 B du CGI »].</p>
      <p>Directeur de la publication : [nom]. Contact : [adresse e-mail].</p>
      <h2 className="font-bold">Hébergement</h2>
      <p>Site : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis [adresse à vérifier]. Base de données : Supabase, région Union européenne.</p>
      <h2 className="font-bold">Nature du service</h2>
      <p>SOS Maison fournit des conseils indicatifs générés en partie par intelligence artificielle. Ils ne remplacent pas l&apos;intervention d&apos;un professionnel qualifié. En cas de danger, appelez le 112.</p>
    </article>
  );
}
