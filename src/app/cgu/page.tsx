export const metadata = { title: "Conditions d'utilisation — SOS Maison" };

// MODÈLE À FAIRE RELIRE PAR UN JURISTE avant la mise en ligne.
export default function Page() {
  return (
    <article className="card prose-chat mt-6 space-y-3">
      <h1 className="text-2xl font-extrabold text-ink">Conditions générales d&apos;utilisation</h1>
      <h2 className="font-bold">1. Le service</h2>
      <p>SOS Maison est un assistant d&apos;aide au dépannage domestique. Les réponses sont produites en partie par une intelligence artificielle et peuvent comporter des erreurs. Vous restez seul juge de l&apos;opportunité de réaliser une intervention.</p>
      <h2 className="font-bold">2. Sécurité</h2>
      <p>Le service refuse de guider les interventions dangereuses (gaz, chaudière, tableau électrique, structure, amiante…) et oriente vers un professionnel ou les secours. Ne réalisez jamais une opération dont vous n&apos;êtes pas sûr.</p>
      <h2 className="font-bold">3. Compte et crédits</h2>
      <p>Chaque nouveau compte reçoit des crédits gratuits, une seule fois par adresse e-mail. Les crédits n&apos;ont pas de valeur monétaire et ne sont ni remboursables ni cessibles.</p>
      <h2 className="font-bold">4. Abonnement Premium</h2>
      <p>L&apos;abonnement donne accès au service sans décompte de crédits, dans la limite d&apos;un usage raisonnable : [plafonds mensuels]. Il est sans engagement et résiliable à tout moment depuis votre compte. Droit de rétractation de 14 jours : [modalités].</p>
      <h2 className="font-bold">5. Annuaire d&apos;artisans</h2>
      <p>SOS Maison met en relation des particuliers et des professionnels indépendants. SOS Maison n&apos;est pas partie au contrat conclu avec l&apos;artisan et n&apos;est pas responsable de son intervention.</p>
      <h2 className="font-bold">6. Responsabilité</h2>
      <p>[Clause de limitation de responsabilité à rédiger avec un juriste.]</p>
      <h2 className="font-bold">7. Droit applicable</h2>
      <p>Droit français. Médiateur de la consommation : [nom et coordonnées].</p>
    </article>
  );
}
