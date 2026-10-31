# SOS Maison — version 0.4

[![Déployer sur Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsang-et-or%2Fsos-maison&project-name=sos-maison&env=DATABASE_URL,ANTHROPIC_API_KEY,RESEND_API_KEY,EMAIL_FROM,ADMIN_EMAILS,CRON_SECRET,APP_URL&envLink=https%3A%2F%2Fgithub.com%2Fsang-et-or%2Fsos-maison%2Fblob%2Fmain%2Fdocs%2FMISE-EN-LIGNE.md)

Assistant de dépannage domestique avec Toit-Toit, la mascotte : conversation avec l'IA, photos, caméra en direct,
voix (dictée, lecture des réponses, mode mains libres), fiches de réparation à cocher, tutoriels vérifiés, guides
d'entretien illustrés, sécurité renforcée, comptes sans mot de passe, annuaire et espace artisan, abonnement Premium,
administration, application installable.

**Mise en ligne : suivez [docs/MISE-EN-LIGNE.md](docs/MISE-EN-LIGNE.md)** (45 minutes, aucune ligne de commande).

## Ce qui est livré

Chaque envoi sur GitHub compile le site et lance tous les tests (onglet *Actions*) : types, tests unitaires,
tests de la base PostgreSQL 16, compilation, puis un parcours de bout en bout sur le site démarré.

| Fonction | Vérification automatique |
| --- | --- |
| Base de données, crédits, RGPD, annuaire, abonnements | Tests SQL |
| Moteur de sécurité (5 niveaux, écran d'urgence, numéros) | 20 situations + parcours urgence gaz sans débit |
| Liens vérifiés (aucune adresse inventée) | Tests unitaires |
| Fiche de réparation (étapes à cocher, économies estimées) | Bout en bout |
| Guides d'entretien (17 guides, schémas, saisons) | Pages et contenu testés |
| Espace artisan (inscription, SIRET contrôlé, validation, demandes reçues) | Bout en bout |
| Administration (indicateurs, coûts, validation des artisans, crédits, réglages, journal) | Bout en bout |
| Premium et packs de crédits (Stripe Checkout, webhook signé, portail client) | Signature, rejeu, crédit unique : bout en bout |
| Voix et caméra (dictée, lecture, mains libres, caméra arrière avec lampe) | Fonctions testées ; micro et caméra à essayer sur téléphone |

Ce qui ne peut être vérifié qu'après la mise en ligne, avec vos clés : les réponses de l'IA, l'envoi réel des
e-mails, un vrai paiement Stripe (mode test d'abord), la recherche Google.

**Nouveau dans la version 0.4**

- **Guides d'entretien** dans le site complet : 17 guides illustrés, étapes à cocher, sélection de la saison sur l'accueil.
- **Espace artisan** (`/pro`) : fiche gratuite, SIRET vérifié par sa clé de contrôle, visible seulement après
  validation ; demandes reçues avec le diagnostic de Toit-Toit (si le client l'accepte), boutons Accepter / Refuser / Terminé.
- **Administration** (`/admin`, comptes listés dans `ADMIN_EMAILS`) : comptes, actifs, Premium, dépannages, urgences,
  recettes estimées et coûts des services du mois, artisans à vérifier avec lien vers l'annuaire officiel des
  entreprises, crédits offerts, réglages (prix, crédits, plafonds), journal.
- **Premium à 2,99 €/mois ou 29,90 €/an** et **pack de 100 crédits à 1,99 €** via Stripe ; résiliation et factures dans
  le portail Stripe ; abonnement résilié automatiquement si le compte est supprimé.
- **Voix** : bouton « Écouter » sur chaque réponse, **mode mains libres** (on parle, Toit-Toit répond à voix haute,
  puis écoute de nouveau). **Caméra en direct** : on filme, on envoie l'image au bon moment, lampe si le téléphone en a une.
  La voix utilise la reconnaissance et la synthèse vocales du navigateur : gratuites, mais pas une conversation
  temps réel avec l'IA.
- Sans clé d'IA, le site refuse poliment les messages et photos **avant** tout débit de crédits ; sans clé Brave,
  l'outil de recherche n'est pas proposé.

## Version installable publique (GitHub Pages)

Le dossier `appli/` contient une version autonome de SOS Maison, installable sur téléphone et utilisable hors
connexion : guides illustrés, entretien de saison, écran d'urgence, recherche d'artisans, équipements et historique
(enregistrés sur le téléphone). Elle est publiée automatiquement par `.github/workflows/pages.yml` à chaque
modification du dossier `appli/`. Sans serveur, l'assistant IA n'y répond pas : il oriente vers les guides et le bon artisan.
L'assistant complet arrive avec la mise en ligne du site Next.js ci-dessous.

## Mettre le site en ligne

Le guide complet est dans [docs/MISE-EN-LIGNE.md](docs/MISE-EN-LIGNE.md) : Supabase, Anthropic, Resend, Vercel,
puis en option Brave, Google Maps et Stripe. Les tables sont créées automatiquement à chaque déploiement Vercel
(`npm run vercel-build` applique les migrations manquantes, puis compile).

L'offre gratuite de Vercel est réservée à un usage non commercial : passez à l'offre Pro au lancement.

## Développement

```bash
cp .env.example .env.local      # puis remplir
npm install
npm run db:migrate
npm run db:seed                 # artisans de démonstration
npm run dev
```

Tests : `npm test` (unitaires), `npm run test:db` (base), `npx tsx tests/smoke.ts` (site lancé).

## Organisation

```
db/migrations/      schéma SQL (fonctions de crédits, RGPD, annuaire)
db/tests/           tests de la base
src/lib/safety/     classification des risques et consignes d'urgence (textes fixes)
src/lib/search/     recherche Brave et filtre des liens
src/lib/credits/    règles de crédits et d'usage raisonnable
src/lib/ai/         instructions de l'assistant, appels Claude, coûts
src/app/api/        routes serveur (connexion, conversation, photos, compte)
src/app/            pages
src/components/     conversation, accueil, rendu des réponses
tests/              tests unitaires et de bout en bout
```

## Sécurité

- Les clés d'API ne quittent jamais le serveur.
- Chaque message passe par des règles fixes puis par un second avis de l'IA ; le niveau le plus élevé l'emporte
  et un dépannage ne redescend jamais de niveau.
- En urgence, aucune réponse n'est générée : consignes relues et numéros d'urgence uniquement, sans débit de crédits.
- Connexion par lien unique valable 15 minutes (5 demandes par heure et par adresse au maximum).
- Photos vérifiées par leur contenu (JPEG, PNG, WebP, 1 Mo au plus), privées, effacées après 90 jours.
- Les pages légales sont des **modèles à compléter et à faire relire** (champs entre crochets).
- Paiements : aucune donnée de carte ne transite par SOS Maison ; chaque notification Stripe est vérifiée par sa
  signature et n'est traitée qu'une fois (pas de double crédit en cas de rejeu).
- Espace artisan et administration : chaque action est contrôlée côté serveur (propriétaire de la fiche, rôle
  administrateur) et inscrite au journal.
