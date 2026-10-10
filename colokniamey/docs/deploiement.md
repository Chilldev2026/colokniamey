# Déploiement (F1)

## Choix de l'hébergeur : Cloudflare Pages

Conditions vérifiées sur les sites officiels le 10 octobre 2026.

| Hébergeur | Offre gratuite (extraits officiels) | Adapté ? |
|---|---|---|
| **Cloudflare Pages** | 500 builds par mois, 20 000 fichiers par site, 25 Mio par fichier ; fichiers `_headers` (100 règles) et `_redirects` pris en charge ; aucune limite de bande passante indiquée sur la page des limites | **Oui (recommandé)** |
| Netlify | offre à crédits : « 300 credit limit » ; transfert facturé 20 crédits par Go, déploiement de production 15 crédits | Possible, mais le quota se consomme vite |
| Vercel | Hobby : 100 Go par mois, mais « réservé à un usage personnel, non commercial » | Non, par prudence juridique |
| GitHub Pages | 1 Go de site, 100 Go par mois de transfert (seuil souple) ; **pas d'en-têtes HTTP personnalisés** | Non : impossible d'appliquer CSP, HSTS et Permissions-Policy |

Raisons du choix : les **en-têtes de sécurité** (RGP02, RGP07) sont obligatoires et ne sont possibles que sur Cloudflare Pages ou Netlify ; tu utilises déjà Cloudflare (Turnstile) ; le plan gratuit suffit largement. Sources : `developers.cloudflare.com/pages/platform/limits/`, `netlify.com/pricing/`, `vercel.com/pricing`, `docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits`.

## Ce qui est déjà prêt dans le dépôt

- `public/_headers` : CSP, HSTS, Referrer-Policy, Permissions-Policy, nosniff, avec l'adresse du projet Supabase.
- `public/_redirects` : toute route inconnue renvoie `index.html` (le routeur Vue prend le relais).
- Le service worker ne met jamais en cache les réponses Supabase (RGP08).

## Étapes (à faire par toi : elles demandent ton compte Cloudflare)

1. **Cloudflare** → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → choisis le dépôt `colokniamey`. **Attention** : ce dépôt GitHub contient plusieurs projets ; ColokNiamey est dans le dossier `colokniamey/`.
2. Réglages de construction : **Root directory = `colokniamey`** ; *Framework preset* = **Vue** (ou aucun) ; commande de build `npm run build-only` ; dossier de sortie `dist` ; variable `NODE_VERSION` = `24`.
3. **Variables d'environnement** (onglet *Settings → Variables*), mêmes noms que dans `.env.example` :
   - `VITE_SUPABASE_URL` : l'adresse du projet (`https://ltwotymheaverxdruqud.supabase.co`) ;
   - `VITE_SUPABASE_ANON_KEY` : la clé **publique** « anon » ou « publishable » (jamais `service_role` ni clé secrète) ;
   - `VITE_TURNSTILE_SITE_KEY` : la clé de site Turnstile.
4. Lance le déploiement. Tu obtiens une adresse `https://<nom>.pages.dev`.
5. **Turnstile** : dans Cloudflare → Turnstile → ton widget → ajoute le nom de domaine du site (`<nom>.pages.dev`) à la liste des domaines.
6. **Supabase → Authentication → URL Configuration** :
   - *Site URL* : `https://<nom>.pages.dev` ;
   - *Redirect URLs* : `https://<nom>.pages.dev/**` (garde `http://localhost:5173/**` pour le développement).
7. **Secrets des Edge Functions** (une fois, depuis ton ordinateur) :
   - `npx supabase secrets set ORIGINES_AUTORISEES=https://<nom>.pages.dev,http://localhost:5173` ;
   - `npx supabase secrets set APP_URL=https://<nom>.pages.dev` ;
   - `npx supabase secrets set RESEND_API_KEY=<clé Resend>` (e-mails du super-admin, voir `docs/securite/configuration-auth.md`) ;
   - `CRON_SECRET` et `KYC_CLE` sont déjà enregistrés. Les Edge Functions sont déjà déployées ; pour les redéployer : `npx supabase functions deploy <nom> --use-api`.
8. Après la première mise en ligne, **mets à jour la politique de confidentialité** (texte à toi) : Cloudflare Pages héberge le site, Turnstile et les tuiles OpenStreetMap sont les seuls services tiers.

## Vérifications sur l'adresse de production

1. **En-têtes** : ouvre `https://securityheaders.com` (ou `curl -I https://<nom>.pages.dev`) et vérifie la présence de `Strict-Transport-Security`, `Content-Security-Policy`, `Permissions-Policy`, `X-Content-Type-Options`. La console du navigateur ne doit montrer **aucune violation de CSP** pendant : inscription (Turnstile), carte, envoi d'une photo (analyse nsfwjs), caméra (si le KYC est actif). Si une violation apparaît, elle indique la source à ajouter dans `public/_headers`.
2. **Installation réelle** :
   - *Android (Chrome)* : ouvre le site, bouton « Télécharger l'application » (ou menu → Installer), vérifie l'icône et le mode plein écran ;
   - *iPhone (Safari)* : le guide « Sur l'écran d'accueil » s'affiche ; Partager → Sur l'écran d'accueil ;
   - hors ligne : coupe le réseau, la page « hors ligne » s'affiche ; mise à jour : redéploie et vérifie le message « Nouvelle version ».
3. **« Localiser ma maison »** sur un téléphone (HTTPS obligatoire pour la géolocalisation) : autoriser, refuser, mode avion (messages d'erreur clairs), précision affichée.
4. **Aucune clé secrète dans le code compilé** : `npx gitleaks detect --no-git -s dist` ou, sans outil : `git grep -n service_role -- dist` et recherche de `eyJ` : seule la clé publique doit apparaître.
5. **Tests contre la production** (ordinateur) : `npm run test:attaques` (avec `SUPABASE_URL` et `SUPABASE_ANON_KEY`), `npm run test:sql`.
6. **OWASP ZAP** : GitHub → *Actions* → « Analyse OWASP ZAP » → *Run workflow* avec l'adresse du site. Télécharge l'artefact `rapport-zap` pour le mémoire.

## Mise à jour du site

Chaque `git push` sur `main` redéploie automatiquement (Cloudflare Pages). Les utilisateurs reçoivent le message « Nouvelle version disponible » (RG27). Les migrations de base se passent à part : `npx supabase db push`, puis `npm run test:sql`.
