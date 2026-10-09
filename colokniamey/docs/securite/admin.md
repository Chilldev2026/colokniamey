# Espace admin (module A2) : mise en route et exploitation

## 1. À régler une fois dans Supabase

1. **Activer le TOTP** : Authentication → Sign In / Providers → Multi-Factor → *TOTP* : activer *Enroll* et *Verify*.
   Sans cela, l'écran `/admin/mfa` affiche « Vérifie qu'elle est activée dans Supabase ».
2. **Secrets des Edge Functions** (Edge Functions → Secrets, ou `npx supabase secrets set NOM=valeur`) :

   | Secret | Rôle | État |
   |---|---|---|
   | `CRON_SECRET` | authentifie l'appel quotidien de `admin-recapitulatif` | déjà posé (aussi dans Vault : `cron_secret`) |
   | `RESEND_API_KEY` | envoi des e-mails (`core-envoyer-email`, `admin-recapitulatif`) | **à poser** |
   | `ORIGINES_AUTORISEES` | CORS : adresses de l'application, séparées par des virgules | **à poser** avec l'adresse de production |
   | `APP_URL` | lien « espace admin » dans le récapitulatif | facultatif |

   Sans `RESEND_API_KEY`, le récapitulatif répond 503 « non configuré » : les alertes dans l'application, elles, fonctionnent.
   Resend sans domaine vérifié n'écrit qu'à l'adresse du compte Resend : celle du super-admin (RGA30).
3. **Premier super-admin** : `supabase/scripts/promouvoir_super_admin.sql` (voir aussi `acces-urgence.md`).

## 2. Ce qui tourne automatiquement (pg_cron)

| Tâche | Fréquence | Effet |
|---|---|---|
| `a2-taches-15-min` | toutes les 15 min | alertes des files (RGA29, RGA34), fin des suspensions à durée limitée, purge des sessions admin anciennes |
| `a2-recapitulatif-quotidien` | 7 h UTC (8 h à Niamey) | appelle `admin-recapitulatif` via pg_net, avec le secret du Vault |

Vérifier : `select jobname, schedule, active from cron.job;` et `select * from cron.job_run_details order by runid desc limit 5;`.

## 3. Contrat pour les modules à file (K, A3, M7)

Un module qui a une file de travail pour les admins :
1. crée une vue `file_<nom>` avec `security_invoker = true` et deux colonnes : `nombre bigint`, `plus_ancien timestamptz` ;
2. l'inscrit : `insert into public.files_admin (nom, libelle, vue, lien) values ('annonces', 'Annonces à valider', 'file_annonces', '/admin/moderation/annonces');`
3. déclare dans ses routes admin `meta.menuAdmin = { …, fileAdmin: 'annonces' }` pour que le compteur s'affiche dans la barre latérale ;
4. peut exposer `compteurs_utilisateur_<module>(uid) returns jsonb` (fonction interne sans GRANT) pour enrichir la fiche utilisateur.

Les alertes ne contiennent que le libellé de la file, le nombre et l'ancienneté (RGA33).

## 4. Sessions admin : comment ça marche (RGA36)

- `est_admin()` exige un jeton `aal2`, un compte admin actif **et** une ligne `sessions_admin` pour la session du jeton, active depuis moins de 30 minutes.
- L'interface appelle `signaler_activite_admin()` au plus toutes les 5 minutes tant que l'admin agit.
- Une session **expirée ne se ressuscite pas** : une session sans ligne ne peut en créer une que dans les 10 minutes qui suivent la vérification du code TOTP (claim `amr` du jeton). Passé 30 minutes d'inactivité, il faut se reconnecter et redonner un code.
- L'avertissement « Déconnexion dans 2 minutes » et le bouton « Rester connecté » sont dans l'interface (`useSessionAdmin`).
- `est_super_admin()` s'appuie sur `est_admin()` : la règle s'applique aussi au super-admin.

## 5. Modifications d'objets d'autres modules (à signaler)

- `est_admin()` et `est_super_admin()` de M2 : remplacées dans `0910_admin_utilisateurs.sql` (autorisé par le contrat).
- Déclencheur `profils_dernier_super` sur `profils` (M2) : empêche de retirer, suspendre ou supprimer le dernier super-admin actif (RGA03), même par SQL ou par `service_role`.
- Les anciens tests SQL (0300, 0350, 0400) créent maintenant une ligne `sessions_admin` pour leur admin simulé.

## 6. Limites connues

- **Édition des rôles** : le rôle `super_admin` ne se donne que par script SQL (RGA05). Un super-admin ne peut pas en rétrograder un autre (RGA02) ; seule la réinitialisation du MFA fait exception (RGA38).
- **Téléphone et WhatsApp** : un numéro de 8 chiffres sans indicatif est complété par +227 [À VALIDER].
- **E-mail direct** : tant que `email_domaine_verifie` est faux, l'e-mail de relance s'ouvre dans la messagerie du super-admin (lien `mailto:`). Le paramètre se règle en A5.
- **Alertes urgentes par e-mail** : le récapitulatif quotidien met les files de plus de 24 h en tête ; il n'y a pas d'e-mail séparé à la minute. La préférence « alertes urgentes » est enregistrée pour un envoi futur.
- **Test réel du MFA** : l'inscription et le défi TOTP utilisent l'API de Supabase Auth et n'ont pas pu être testés automatiquement. À essayer à la main avec un vrai téléphone (voir les captures listées dans le compte rendu).
