export const metadata = { title: "Confidentialité — SOS Maison" };

// MODÈLE À COMPLÉTER ET FAIRE RELIRE avant la mise en ligne.
export default function Page() {
  return (
    <article className="card prose-chat mt-6 space-y-3">
      <h1 className="text-2xl font-extrabold text-brand-900">Politique de confidentialité</h1>
      <p>Responsable du traitement : [nom, adresse, e-mail de contact].</p>
      <h2 className="font-bold">Données collectées</h2>
      <ul>
        <li>Adresse e-mail (connexion) ; code postal si vous le donnez.</li>
        <li>Messages et photos de vos dépannages, équipements que vous enregistrez.</li>
        <li>Historique des crédits et de l&apos;abonnement.</li>
      </ul>
      <h2 className="font-bold">Pourquoi</h2>
      <p>Fournir l&apos;assistance (exécution du contrat), sécuriser le service et prévenir la fraude aux crédits offerts (intérêt légitime : nous conservons une empreinte chiffrée de votre e-mail après suppression du compte), respecter nos obligations comptables.</p>
      <h2 className="font-bold">Durées de conservation</h2>
      <p>Photos : 90 jours, sauf si vous conservez le dépannage. Compte : jusqu&apos;à sa suppression. Factures : 10 ans.</p>
      <h2 className="font-bold">Sous-traitants</h2>
      <p>Anthropic (analyse des messages et photos), Google (voix et vidéo en direct, à venir), Brave (recherche de tutoriels), Vercel (hébergement), Supabase (base de données, UE), Resend (e-mails), Stripe (paiement). Les transferts hors UE sont encadrés par les clauses contractuelles types de la Commission européenne.</p>
      <h2 className="font-bold">Caméra et micro</h2>
      <p>Ils ne sont utilisés que lorsque vous appuyez sur le bouton correspondant. Seules les photos que vous choisissez d&apos;envoyer sont conservées.</p>
      <h2 className="font-bold">Vos droits</h2>
      <p>Vous pouvez télécharger ou supprimer vos données à tout moment depuis « Mon compte ». Pour toute autre demande : [e-mail]. Vous pouvez saisir la CNIL (cnil.fr).</p>
    </article>
  );
}
