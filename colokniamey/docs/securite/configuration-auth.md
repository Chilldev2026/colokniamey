# Réglages de Supabase Auth et de Turnstile (module M2)

Ces réglages se font dans le tableau de bord Supabase : ils ne sont pas dans le code. La base protège
quand même l'essentiel (déclencheur `handle_new_user`, RLS), mais ces réglages ferment le reste.

## 1. Supabase Auth (Authentication)

| Réglage | Où | Valeur | Règle |
|---|---|---|---|
| Longueur minimale du mot de passe | Authentication → Sign In / Providers → Email | **8** | RG04 |
| Confirmation de l'e-mail | Authentication → Sign In / Providers → Email → « Confirm email » | **activée** | RGP06 |
| Inscriptions | Authentication → Sign In / Providers → « Allow new users to sign up » | activée (le paramètre `inscriptions_ouvertes` ferme ensuite côté base) | RGA15 |
| Fournisseurs | Email seulement | autres désactivés | minimisation |
| URL du site | Authentication → URL Configuration → Site URL | adresse de production (en développement : `http://localhost:5173`) | |
| URL de redirection autorisées | Authentication → URL Configuration → Redirect URLs | `http://localhost:5173/**` et `https://<ton-domaine>/**` (`/connexion` et `/reinitialiser` y sont utilisés) | |
| Limites de tentatives | Authentication → Rate Limits | laisser les valeurs par défaut au minimum : e-mails par heure (faible sur l'offre gratuite), connexions par 5 min et par IP, inscriptions par heure et par IP | RGP20 |
| MFA TOTP | Authentication → Sign In / Providers → Multi-Factor → « TOTP » | **Enroll et Verify activés** | RGA04 |
| Sessions | Authentication → Sessions | l'offre gratuite n'a pas de limite d'inactivité : elle est appliquée par l'application (RGP28) et par la base pour les admins (RGA36) | |

Des e-mails de confirmation en français : Authentication → Email Templates → modifier « Confirm signup » et
« Reset password » (texte court, sans donnée personnelle autre que le lien).

## 2. Cloudflare Turnstile (gratuit) — RGP19

1. Crée un compte gratuit sur <https://dash.cloudflare.com/sign-up> (sans carte bancaire).
2. Menu **Turnstile → Add widget**.
3. **Widget name** : `ColokNiamey`. **Hostname Management** : ajoute les adresses autorisées, une par ligne :
   - `localhost` (développement) ;
   - le domaine de production quand il existe (par exemple `colokniamey.pages.dev`).
4. **Widget Mode** : *Managed* (recommandé). Valide : Cloudflare donne une **Site Key** (publique) et une **Secret Key**.
5. **Site Key** → dans `.env` : `VITE_TURNSTILE_SITE_KEY=...` (clé publique, sans danger dans le frontend).
6. **Secret Key** → seulement dans Supabase : Authentication → Attack Protection → **Enable CAPTCHA protection**,
   fournisseur *Cloudflare Turnstile*, colle la Secret Key. Elle ne va **jamais** dans `.env`, dans le code ni dans Git.
7. Test : sans jeton, l'inscription doit être refusée par Supabase (« captcha verification process failed »).
   Avec le widget, elle passe.

Ensuite, ajoute le service à la politique de confidentialité : `challenges.cloudflare.com` est le seul script tiers
de l'application (texte à valider avec l'auteur, voir `src/core/legal/confidentialite.md`). L'en-tête CSP de
`public/_headers` l'autorise déjà.

## 3. Premier super-admin

Voir `supabase/scripts/promouvoir_super_admin.sql` : inscris-toi dans l'application, confirme ton e-mail, puis
exécute le script dans l'éditeur SQL avec ton adresse. Procédure de secours : `docs/securite/acces-urgence.md`.
