# SOS Maison — version 0.2

Assistant de dépannage domestique avec Toit-Toit, la mascotte : conversation avec l'IA, photos, dictée,
fiches de réparation à cocher, tutoriels vérifiés, sécurité renforcée, comptes sans mot de passe,
annuaire d'artisans avec demande d'intervention, application installable.

## Ce qui est livré

| Fonction | État |
| --- | --- |
| Base de données (19 tables + fiches de réparation, crédits, RGPD, annuaire) | Testée sur PostgreSQL 16 |
| Moteur de sécurité (5 niveaux, écran d'urgence, numéros) | Testé (20 situations) |
| Liens vérifiés (aucune adresse inventée) | Testé |
| Crédits et usage raisonnable Premium | Testés, y compris 40 débits simultanés |
| Fiche de réparation générée par l'IA (validation, étapes à cocher, économies estimées) | Testée |
| Composants de l'interface (accueil, conversation, fiche, artisans, barre d'onglets) | Rendu testé avec React |
| Site Next.js complet | Écrit et vérifié en syntaxe ; **pas encore compilé** (npm indisponible ici) : GitHub le compilera et lancera le test de bout en bout au premier envoi |

**Nouveau dans cette version**

- Design « Toit-Toit » : bandeau mandarine, mascotte animée, tuiles colorées, exemples de problèmes à toucher,
  six domaines en icônes, barre d'onglets en bas comme une application, polices très lisibles.
- Fiche de réparation interactive : l'IA remplit une fiche structurée (diagnostic, outils, durée, coût des pièces,
  sécurité, étapes). On coche les étapes, la progression est enregistrée ; une fois tout coché, Toit-Toit demande
  si ça marche, et la réussite est fêtée avec des confettis.
- Mon espace : jauge de crédits, problèmes résolus, économies estimées (prix d'artisan évité).
- Annuaire : filtres par métier, badges, et **demande d'intervention** envoyée par e-mail à l'artisan, avec le
  résumé du dépannage seulement si l'utilisateur coche la case (5 demandes par jour au maximum).
- Écran d'urgence redessiné : alerte animée, consignes numérotées, numéros en grand.

**Pas encore fait** : espace artisan (création et gestion de fiche), abonnement Stripe, conversation vocale et
vidéo en direct, tableau de bord administrateur. « Parler » utilise la dictée du téléphone ; « Montrer en vidéo » prend une photo.

## Mettre le site en ligne gratuitement

Seule la clé d'IA est payante (à l'usage, quelques euros suffisent pour tester).

1. **GitHub** (gratuit) — créez un compte sur github.com, puis un dépôt privé `sos-maison` et envoyez-y ce dossier.
   L'onglet *Actions* compile et teste automatiquement le site à chaque modification.
2. **Supabase** (offre gratuite) — créez un projet en région *Europe*. Dans *Project Settings → Database*,
   copiez la *Connection string* (mode *Transaction*) : c'est `DATABASE_URL`.
3. **Anthropic** — sur platform.claude.com, ajoutez un moyen de paiement et créez une clé : `ANTHROPIC_API_KEY`.
4. **Brave Search** — sur api-dashboard.search.brave.com, créez une clé (5 $ de crédit offerts chaque mois) : `BRAVE_API_KEY`.
5. **Resend** (offre gratuite) — créez une clé pour envoyer les e-mails de connexion : `RESEND_API_KEY`.
6. **Vercel** — importez le dépôt GitHub, collez les variables de `.env.example`, ajoutez `CRON_SECRET`
   (une longue suite de caractères au hasard), puis déployez.
7. **Créer les tables** — une seule fois, depuis un ordinateur : `DATABASE_URL=... npm run db:migrate`
   (ou collez `db/migrations/0001_init.sql` dans l'éditeur SQL de Supabase).

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
