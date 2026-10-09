# Accès d'urgence au compte super-admin (RGP24)

Le compte super-admin protège les paramètres, la maintenance et la gestion des administrateurs.
S'il est perdu, plus personne ne peut administrer la plateforme depuis l'application. Ce document décrit
comment l'éviter et comment s'en sortir.

## Prévention

1. **Deux facteurs TOTP sur deux appareils.** À la première connexion à l'espace admin, enregistre l'application
   d'authentification (Google Authenticator, Aegis, etc.) sur ton téléphone **et** sur un second appareil
   (autre téléphone, tablette). Un bandeau de rappel s'affiche tant qu'il n'y a qu'un seul facteur (RGA37).
2. **Un second super-admin** dès qu'une personne de confiance est disponible
   [INFORMATION MANQUANTE : seconde personne]. Elle s'inscrit, confirme son e-mail, puis le script
   `supabase/scripts/promouvoir_super_admin.sql` la promeut. Un super-admin peut réinitialiser le MFA d'un autre
   (RGA38), ce qui couvre la perte d'un téléphone.
3. **Gestionnaire de mots de passe** pour le mot de passe du compte, et boîte e-mail du compte protégée par
   sa propre double authentification.

## Perte du téléphone (premier facteur TOTP)

- **Si le second facteur existe** : connecte-toi avec le second appareil, puis, dans l'espace admin, supprime
  le facteur perdu et enregistre-en un nouveau.
- **Si un autre super-admin existe** : il utilise « Réinitialiser la double authentification » (RGA38,
  motif obligatoire, journalisé et notifié à tous les super-admins). Tu enregistres ensuite un nouveau facteur.
- **Si aucun des deux n'existe** (dernier recours, l'auteur a accès au tableau de bord Supabase) :
  1. Ouvre le tableau de bord Supabase, section **Authentication → Users**, ouvre le compte concerné.
  2. Supprime ses facteurs MFA (« Remove MFA factors » / « Delete factor »).
  3. Reconnecte-toi, enregistre un nouveau facteur TOTP **sur deux appareils**.
  4. Note l'incident dans le journal du projet (date, cause). La suppression d'un facteur depuis le tableau
     de bord n'est pas journalisée par l'application : l'écrire à la main.

## Perte du mot de passe

Utilise « Mot de passe oublié » sur l'écran de connexion. Le lien arrive sur l'adresse e-mail du compte ;
la double authentification reste exigée ensuite pour entrer dans l'espace admin.

## Perte de l'accès à l'e-mail du compte

Depuis le tableau de bord Supabase (Authentication → Users), modifie l'adresse e-mail du compte, puis
reprends la procédure « mot de passe oublié ».

## Ce qu'il ne faut jamais faire

- Ne mets jamais la clé `service_role` dans l'application pour « débloquer » un accès.
- Ne désactive pas l'exigence `aal2` des politiques d'administration, même temporairement : passe par les
  étapes ci-dessus.
- Ne partage pas le compte super-admin : chaque personne a son propre compte (le journal d'audit en dépend, RGA06).
