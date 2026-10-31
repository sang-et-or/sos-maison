# Mettre SOS Maison en ligne, pas à pas

Durée : environ 45 minutes. Il faut une carte bancaire pour la clé d'IA (payée à l'usage, quelques euros pour tester).
Tout le reste démarre gratuitement. Gardez un fichier texte ouvert pour noter chaque valeur au fur et à mesure.

## 1. La base de données — Supabase (gratuit)

1. Créez un compte sur **supabase.com**, puis **New project**.
   - Nom : `sos-maison` ; région : **West EU (Paris)** ou **Central EU (Frankfurt)** ; notez le mot de passe choisi.
2. Une fois le projet prêt : bouton **Connect** en haut de la page, onglet **Connection string**, mode **Transaction pooler** (port 6543).
3. Copiez l'adresse et remplacez `[YOUR-PASSWORD]` par votre mot de passe.
   → c'est **`DATABASE_URL`** (elle commence par `postgresql://postgres.`).

Les tables sont créées automatiquement par Vercel au premier déploiement.

## 2. La clé d'IA — Anthropic (payant à l'usage)

1. Sur **platform.claude.com**, créez un compte, puis **Billing** : ajoutez 5 à 10 € de crédit.
   Conseil : dans **Limits**, fixez une limite mensuelle (par exemple 20 €).
2. **API Keys → Create Key** → c'est **`ANTHROPIC_API_KEY`** (elle commence par `sk-ant-`).

## 3. Les e-mails de connexion — Resend (gratuit jusqu'à 3 000 e-mails par mois)

1. Créez un compte sur **resend.com** → **API Keys → Create** → c'est **`RESEND_API_KEY`**.
2. Pour commencer, `EMAIL_FROM` peut rester `SOS Maison <onboarding@resend.dev>` : les e-mails n'arrivent alors
   **qu'à l'adresse de votre compte Resend**, pratique pour tester. Pour ouvrir le site au public, ajoutez votre nom
   de domaine dans **Domains** (Resend indique les lignes à copier chez votre hébergeur de domaine), puis utilisez
   par exemple `SOS Maison <bonjour@votre-domaine.fr>`.

## 4. Le site — Render

1. Créez un compte sur **render.com** avec **GitHub** (bouton *Sign in with GitHub*) et autorisez l'accès au dépôt `sos-maison`.
2. Ouvrez ce lien : Render lit le fichier `render.yaml` du dépôt et prépare tout (serveur à Francfort, compilation,
   démarrage).

   https://render.com/deploy?repo=https://github.com/sang-et-or/sos-maison

3. Render demande les variables une par une :

   | Variable | Valeur |
   | --- | --- |
   | `DATABASE_URL` | l'adresse Supabase (étape 1) |
   | `APP_URL` | `https://sos-maison.onrender.com` (à corriger après si Render donne une autre adresse) |
   | `ANTHROPIC_API_KEY` | la clé Anthropic (étape 2) |
   | `RESEND_API_KEY` | la clé Resend (étape 3) |
   | `ADMIN_EMAILS` | votre adresse e-mail (accès à l'administration) |
   | `CRON_SECRET` | une longue suite de lettres et chiffres au hasard (notez-la) |
   | `BRAVE_API_KEY`, `GOOGLE_MAPS_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | laissez vide pour l'instant (voir « En option ») |

4. Formule : **Starter** (payante, le site reste éveillé). Pour un simple essai, vous pouvez choisir **Free** :
   le site s'endort après 15 minutes sans visite et met environ une minute à se réveiller.
5. **Apply / Deploy**. La première compilation prend 3 à 5 minutes ; les tables de la base sont créées à ce moment.
6. Vérifiez l'adresse affichée en haut de la page du service. Si elle diffère de `APP_URL`, corrigez `APP_URL` dans
   *Environment*, puis *Manual Deploy → Deploy latest commit*.
7. **Purge quotidienne des vieilles photos** : sur GitHub, dépôt `sos-maison` → *Settings → Secrets and variables →
   Actions → New repository secret* : `SITE_URL` (l'adresse Render) et `CRON_SECRET` (la même valeur qu'à l'étape 3).

À partir de là, chaque modification envoyée sur GitHub met le site à jour automatiquement.

**Autre possibilité : Vercel.** Le projet fonctionne aussi sur Vercel (bouton dans le README) ; la purge y est
alors faite par Vercel. L'offre gratuite de Vercel ne s'endort pas mais est réservée à un usage non commercial.

## 5. Premier essai

1. Ouvrez le site, **Connexion**, saisissez l'adresse indiquée dans `ADMIN_EMAILS`, cliquez le lien reçu par e-mail.
2. Décrivez un problème simple (« mon évier se vide lentement ») : Toit-Toit répond, la fiche s'affiche.
3. **Mon espace → Administration** : coûts du mois, artisans à vérifier, réglages.

## 6. En option, quand vous voulez

**Recherche de tutoriels** (Brave Search, 5 $ offerts par mois) : clé sur api-dashboard.search.brave.com →
variable `BRAVE_API_KEY`. Sans elle, Toit-Toit répond sans citer de tutoriels en ligne.

**Recherche Google des artisans** (1 000 recherches gratuites par mois, puis 35 $ les 1 000) : console.cloud.google.com
→ activez *Places API (New)* → *Identifiants → Créer une clé*, limitée à cette API → variable `GOOGLE_MAPS_API_KEY`.

**Paiements Premium et packs de crédits** (Stripe : 1,5 % + 0,25 € par paiement par carte européenne) :
1. Compte sur **dashboard.stripe.com**. Restez d'abord en **mode test** (bouton en haut à droite).
2. *Developers → API keys* : la **Secret key** → `STRIPE_SECRET_KEY`.
3. *Developers → Webhooks → Add endpoint* : adresse `https://VOTRE-SITE/api/billing/webhook`, événements
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copiez le **Signing secret** → `STRIPE_WEBHOOK_SECRET`.
4. *Settings → Billing → Customer portal* : activez le portail (résiliation et factures).
5. Redéployez (*Manual Deploy*). Testez avec la carte `4242 4242 4242 4242`, date future, code au choix.
6. Quand tout fonctionne, refaites les étapes 2 à 4 en **mode production** et remplacez les deux clés.

## Avant d'ouvrir au public

- Complétez les pages **Mentions légales**, **Conditions d'utilisation** et **Confidentialité** (les passages entre
  crochets) et faites-les relire par un juriste.
- Gardez Render en formule payante (Starter ou plus) : la formule gratuite n'est pas faite pour la production.
- Activez dans Supabase les sauvegardes adaptées à votre offre.
