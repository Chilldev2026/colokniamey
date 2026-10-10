# Tableau de bord, audit, erreurs et supervision (modules A1 et A6)

## Qui voit quoi (RGA26, RGA27)

| Page | Super-admin | Admin | Fonction SQL | Contrôle |
|---|---|---|---|---|
| Vue d'ensemble (accueil du super-admin) | oui | non | `stats_utilisateurs`, `stats_annonces`, `stats_visites`, `stats_moderation`, `stats_erreurs` | `est_super_admin()` (sauf `stats_moderation` : `est_admin()`) |
| Ma file de travail (accueil de l'admin) | non | oui | `stats_moderation` | `est_admin()` |
| Supervision technique | oui | non | `supervision`, `liste_seuils`, `definir_seuil` | `est_super_admin()` |
| Erreurs | oui | non | `liste_erreurs`, `changer_statut_erreur` | `est_super_admin()` |
| Journal d'audit | oui (tout) | non | `liste_journal`, `filtres_journal` + politique RLS | `est_super_admin()` |
| Mon historique | non | oui (ses lignes) | `liste_journal` + politique RLS | `acteur_id = auth.uid()` |

Masquer un lien ne suffit jamais : chaque fonction revérifie le rôle et le niveau aal2 (`est_admin()`). Le test `supabase/tests/1040_admin_stats_observabilite.test.sql` vérifie le refus pour un étudiant, un visiteur, un admin sans aal2 et un admin sur chaque fonction réservée.

## Statistiques (A1)

- Agrégats seulement : aucune donnée personnelle (RGA18). Les visites sont enregistrées sans IP ni traceur.
- **Visites** : le détail (chemin, appareil, session) est gardé **30 jours** ; chaque nuit (pg_cron `a1-agreger-visites`) les jours terminés sont résumés dans `visites_par_jour` et `visites_detail_par_jour`, puis le détail de plus de 30 jours est supprimé (RGA20).
- **Délai moyen de validation d'une annonce** : écart entre la notification « en cours de vérification » et la validation dans le journal d'audit.
- Période de 7, 30 ou 90 jours ; évolution comparée à la période précédente.
- **Export CSV** : réservé au super-admin ; séparateur « ; », encodage compatible avec les tableurs français, et neutralisation des cellules qui commencent par `=`, `+`, `-` ou `@` (injection de formule).
- Graphiques : composants partagés `GraphiqueCourbe` (tension 0,35, trait de 2 px, une seule échelle verticale, légende dès deux séries) et `GraphiqueCirculaire` (anneau, total au centre, légende avec les valeurs) dans `src/core/ui/graphiques`, couleurs #3A66B0, #E0731F, #3E9B6B, #B05A9A et gris #8A93A3 pour « refusées ou retirées ». Animation de 400 ms coupée avec `prefers-reduced-motion`. Chaque graphique a un **tableau des valeurs** (« Voir les valeurs ») pour les lecteurs d'écran. Chart.js est chargé seulement avec les pages qui l'utilisent.

## Journal d'audit (A6)

Le journal est en **ajout seul** (RGA07) : l'interface n'offre aucune modification ni suppression, et la base les refuse. Filtres : admin, action, type de cible, période. Le détail compare « avant » et « après » quand la ligne contient `ancien/nouveau` ou `avant/apres`. Un admin ne reçoit que ses propres lignes, même s'il essaie de filtrer par un autre admin.

## Erreurs (A6)

`enregistrer_erreur_detail` regroupe les erreurs par empreinte (message et module) et garde : pile (nettoyée : e-mails, jetons, paramètres d'adresse retirés, 2000 caractères), **famille** du navigateur (jamais la version précise), date de construction de l'application, page sans paramètres. Une erreur **résolue qui réapparaît repasse à « nouvelle »**. Suppression après **90 jours** (pg_cron `a6-purger-erreurs`, disponible sur l'offre gratuite : vérifié par le test).

## Supervision (A6) : les quatre indicateurs

1. **Requêtes** (RGA21) : appels mesurés et pages vues par minute (1 h), par heure (24 h) ou par jour (7 j), et par module.
2. **Erreurs** (RGA22) : taux global, par module, pages les plus en échec. Alerte au-delà de **5 %** sur 15 minutes (seuil réglable, au moins 20 mesures pour conclure).
3. **Temps de réponse** (RGA23) : P50, P95, P99 par `percentile_cont`. P95 = ce que vivent les 5 % d'utilisateurs les plus lents ; P99 = les 1 % les plus lents. Seuil d'alerte P95 : 3000 ms [À VALIDER].
4. **Saturation** (RGA24) : taille de la base (`pg_database_size`), stockage de fichiers, connexions actives, comparés aux limites saisies ; alerte à **80 %**.

Les mesures sont anonymes et échantillonnées (RGA25) ; détail gardé **7 jours**, puis agrégat horaire (`mesures_par_heure`, pg_cron `a6-agreger-mesures`), gardé 90 jours.

**Alertes** : toutes les 15 minutes (pg_cron `a6-verifier-seuils`), `verifier_seuils()` évalue les seuils. Un dépassement active une alerte, affiche un **bandeau rouge** dans l'espace du super-admin et **notifie les super-admins** une fois par heure au plus, sans chiffre ni donnée personnelle. L'alerte se lève toute seule au retour à la normale.

### Écarts avec le prompt, et limites

- Les **limites de l'offre gratuite** et les **seuils** sont dans la table `seuils_supervision` (réglables sur la page Supervision), et non dans les paramètres d'A5 : la liste blanche d'A5 est stricte, et ces valeurs ne sont utiles qu'à la supervision. Valeurs de départ : base 500 Mo, stockage 1024 Mo, 60 connexions, 500 000 appels Edge par mois **[À VÉRIFIER sur l'offre Supabase en vigueur]**.
- Les **appels aux Edge Functions** ne sont pas mesurés par l'application (Supabase ne les expose pas à la base) : la limite est saisie à titre de rappel, le chiffre se lit dans le tableau de bord Supabase.
- Les **mesures d'appels** viennent de l'application elle-même (échantillonnées) : elles ne comptent pas les visiteurs qui bloquent le script ni les appels directs à l'API.

## Option : brancher Grafana Cloud (lecture seule)

Conditions relevées sur grafana.com/pricing le 10 octobre 2026 : offre gratuite limitée à 3 utilisateurs actifs par mois, 10 000 séries actives, 14 jours de rétention ; la prise en charge de PostgreSQL comme source de données **n'est pas confirmée sur cette page** [À VÉRIFIER avant de s'engager].

Principe, si tu souhaites le faire pour la soutenance :
1. Crée dans Supabase un **utilisateur SQL dédié en lecture seule**, limité à des **vues d'agrégats** (jamais aux tables) : `create role grafana_lecture login password '<mot de passe fort>'; grant usage on schema public to grafana_lecture;` puis crée des vues (par exemple `supervision_requetes_par_heure`, `supervision_erreurs_par_module`) qui ne contiennent que des comptes et des durées, et `grant select` sur ces seules vues.
2. Dans Grafana Cloud : *Connections → Add new connection → PostgreSQL*, hôte et port du **pooler** de Supabase (*Project Settings → Database*), base `postgres`, utilisateur `grafana_lecture`, SSL obligatoire.
3. Construis les quatre tableaux à partir de ces vues. Ne jamais donner à Grafana la clé `service_role` ni un accès aux tables personnelles.
Cette option n'est pas nécessaire : la page Supervision de l'application montre déjà les quatre indicateurs.
