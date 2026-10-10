# Procédure d'incident de sécurité (RGP14)

À suivre dès qu'on soupçonne une fuite de données, un accès non autorisé ou une clé exposée. Le but : **limiter les dégâts d'abord, comprendre ensuite, informer enfin**. Toutes les étapes sont notées (date, heure, qui, quoi) dans un fichier d'incident daté.

## 1. Arrêter l'hémorragie (dans l'heure)

1. **Mettre l'application en maintenance** : espace admin → Maintenance (super-admin). En maintenance, seuls les admins accèdent à l'application et la base refuse les écritures des autres (RGA15, RGA16).
2. **Si une clé est exposée, la changer tout de suite** :
   - clé `service_role` ou clé secrète Supabase : tableau de bord Supabase → *Project Settings → API keys* → régénérer ; puis mettre à jour les secrets des Edge Functions (`npx supabase secrets set …`) ;
   - `KYC_CLE` : voir `docs/securite/kyc.md` (les images déjà déposées deviennent illisibles : refuser les dossiers concernés) ;
   - `CRON_SECRET`, `RESEND_API_KEY`, clé secrète Turnstile : les régénérer chez le fournisseur et les remettre dans Supabase ;
   - mot de passe de la base : *Project Settings → Database → Reset database password*.
3. **Suspendre les comptes concernés** (espace admin → Utilisateurs) et, si un compte admin est en cause, réinitialiser son double facteur (super-admin, motif obligatoire) ou le rétrograder.
4. **Déconnecter tout le monde** si la fuite touche les sessions : *Authentication → Sessions* ou changement de la clé JWT.

## 2. Comprendre

- Lire le **journal d'audit** (`journal_audit`, en ajout seul) : actions admin, consultations d'images d'identité, décisions.
- Lire les journaux de l'API et d'authentification du tableau de bord Supabase (période de l'incident).
- Lister **quelles données** étaient accessibles, **combien de personnes** et **depuis quand**. Classification (RGP) : *très sensible* = pièces et selfies d'identité ; *confidentiel* = messages privés ; *personnel* = nom, e-mail, téléphone, position exacte ; *interne* = journaux.
- Corriger la cause (politique RLS, fonction trop ouverte, clé commitée), la couvrir par un test dans `supabase/tests` et relancer `npm run test:sql` et `npm run test:attaques`.

## 3. Évaluer le risque

Un risque est **élevé** si des données très sensibles ou confidentielles, ou des données personnelles de nombreuses personnes, ont pu être lues ou copiées par un tiers, et peuvent causer un tort (usurpation d'identité, harcèlement, fraude). En cas de doute, traiter comme élevé.

## 4. Informer

Si le risque est élevé :
- **l'autorité de protection des données** dans le délai prévu par la loi (cadre : loi n° 2022-59 du 16 décembre 2022 modifiée par la loi n° 2023-31 du 4 juillet 2023, autorité HAPDP) **[RÉFÉRENCE À VÉRIFIER sur le texte officiel : délai et formulaire]** ;
- **les personnes concernées**, par notification dans l'application et par e-mail : ce qui s'est passé, quelles données, ce qu'elles doivent faire (changer de mot de passe, se méfier des messages suspects), qui contacter (devchill132@gmail.com, +227 85 81 20 69 ou +227 77 10 20 05).

Toute communication reste factuelle : aucune donnée personnelle d'une autre personne, aucune spéculation.

## 5. Rétablir et apprendre

1. Lever la maintenance une fois la cause corrigée et les clés changées.
2. Restaurer les données si elles ont été altérées : voir `docs/securite/sauvegarde.md`.
3. Écrire un court **bilan** : chronologie, cause, correctif, ce qui change dans la procédure. Le joindre au fichier d'incident.
4. Mettre à jour les tests et la liste des fonctions autorisées (`supabase/tests/audit_securite.test.sql`) si la cause l'exige.

## Contacts et accès d'urgence

L'accès d'urgence (deuxième appareil TOTP ou deuxième super-admin) est décrit dans `docs/securite/acces-urgence.md`. [INFORMATION MANQUANTE : seconde personne pour le rôle de super-admin].
