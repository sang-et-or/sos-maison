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
      <p>Chaque nouveau compte reçoit des crédits gratuits, une seule fois par adresse e-mail. Des packs de crédits peuvent être achetés ; les crédits achetés n&apos;expirent pas. Les crédits ne sont pas cessibles et ne peuvent pas être convertis en argent. Les situations d&apos;urgence détectées ne consomment jamais de crédit.</p>
      <h2 className="font-bold">4. Abonnement Premium</h2>
      <p>L&apos;abonnement (2,99&nbsp;€ TTC par mois ou 29,90&nbsp;€ TTC par an) donne accès au service sans décompte de crédits, dans la limite d&apos;un usage raisonnable par mois : 20 nouveaux dépannages, 60 photos, 30 recherches de tutoriels, 20 minutes de voix et 10 minutes de vidéo. Le paiement est traité par Stripe ; SOS Maison ne voit ni ne conserve vos numéros de carte. L&apos;abonnement est sans engagement et se renouvelle automatiquement ; il se résilie à tout moment depuis « Mon espace », avec effet à la fin de la période payée.</p>
      <p>Droit de rétractation : vous disposez de 14 jours après la souscription ou l&apos;achat. En utilisant le service pendant ce délai, vous demandez qu&apos;il commence immédiatement ; en cas de rétractation, seul le montant correspondant à l&apos;usage déjà fait reste dû. [Modalités et formulaire de rétractation à valider avec un juriste.]</p>
      <h2 className="font-bold">5. Annuaire d&apos;artisans</h2>
      <p>SOS Maison met en relation des particuliers et des professionnels indépendants. SOS Maison n&apos;est pas partie au contrat conclu avec l&apos;artisan et n&apos;est pas responsable de son intervention.</p>
      <p>Les artisans s&apos;inscrivent gratuitement et sans commission. Chaque fiche est vérifiée (numéro SIRET) avant d&apos;apparaître dans l&apos;annuaire ; elle peut être suspendue en cas d&apos;informations inexactes ou de réclamations répétées. Les résultats issus de Google Maps sont fournis à titre indicatif et ne sont pas vérifiés par SOS Maison.</p>
      <h2 className="font-bold">6. Responsabilité</h2>
      <p>[Clause de limitation de responsabilité à rédiger avec un juriste.]</p>
      <h2 className="font-bold">7. Droit applicable</h2>
      <p>Droit français. Médiateur de la consommation : [nom et coordonnées].</p>
    </article>
  );
}
