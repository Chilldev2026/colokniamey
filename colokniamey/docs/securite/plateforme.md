# Plateforme (module A5) : maintenance, paramètres, référentiel

## Maintenance (RGA15, RGA16)

- Le super-admin l'active dans **Pilotage → Maintenance** (message, fin prévue, aperçu, confirmation). La fonction `definir_maintenance()` vérifie `est_super_admin()` et journalise.
- En maintenance : la base refuse toute écriture des non-admins (`peut_ecrire()`), l'application affiche la page de maintenance, et un **bandeau rouge** reste visible dans l'espace admin.
- **Temps réel** : un trigger sur `parametres` diffuse chaque changement d'un paramètre *public* sur le canal privé `plateforme` (`realtime.send`, politique de lecture sur `realtime.messages` pour visiteurs et connectés). L'application s'abonne au démarrage (`core/plateforme.ts`) et bascule sans recharger. Si Realtime est indisponible, l'état est relu à la navigation suivante (cache de 60 s) : la base reste la source de vérité.
- La fin prévue est **informative** : la maintenance ne se désactive pas toute seule.
- Le service Realtime crée les partitions de `realtime.messages` à la première connexion d'un client : tant qu'aucun client ne s'est connecté, l'envoi est ignoré sans erreur.

## Paramètres (RGA17)

`modifier_parametre(cle, valeur)` : super-admin seulement, type et bornes vérifiés par la base, ancienne et nouvelle valeur journalisées. L'admin les voit en lecture seule (`liste_parametres()`).

| Paramètre | Valeurs | Public |
|---|---|---|
| inscriptions_ouvertes, validation_annonces | oui / non | oui |
| photos_max | entier 1 à 10 | oui |
| photo_taille_max_mo, photo_dimension_min, nsfw_seuil | 1–20 Mo, 100–2000 px, 0,3–1 | oui |
| inactivite_etudiant_jours, inactivite_proprietaire_jours | 1–90 jours | oui |
| version_cgu | texte court | oui |
| kyc_actif, kyc_proprietaires | oui / non (non par défaut, RG59) | oui |
| email_domaine_verifie | oui / non | non |
| heure_recapitulatif | 0–23, heure UTC (décale la tâche pg_cron) | non |
| seuil_relance_heures | 1–168 (24 par défaut) | non |

Les **paramètres publics** sont lisibles par tous (`parametres_publics()`) ; les autres ne quittent jamais la base, sauf pour un admin connecté en aal2.

## Référentiel (RG22, RG25 bis, RG29)

- Villes, quartiers, universités, équipements : écriture réservée aux admins (politiques RLS de `0950_plateforme.sql`), chaque opération est journalisée (`referentiel_insert|update|delete`).
- **Suppression d'un élément utilisé** : refusée avec un message clair. Le déclencheur cherche lui-même toutes les clés étrangères qui pointent vers la table : M4 et les modules suivants n'ont rien à ajouter.
- **Placer sur la carte** : le formulaire propose une carte (déplacer, toucher, faire glisser le repère, ou « Placer au centre »), des coordonnées modifiables à la main et un avertissement hors zone. La base refuse de toute façon un point hors de la zone de la ville (RG22). Aucune coordonnée n'est inventée.
- **Compteur « à placer »** : file informative `universites_a_placer` (colonne `alerter = false` : elle n'envoie pas d'alertes aux admins).
- **Équipements** : la table est créée ici (M4 s'y rattache). Elle est **vide** : la liste validée est à saisir dans l'espace admin.

## Modifications d'objets d'autres modules

- A2 : `alertes_files()` et `donnees_recapitulatif()` remplacées (seuil lu dans `seuil_relance_heures`, files informatives ignorées) ; colonne `alerter` ajoutée à `files_admin`.
- M1 : politiques d'écriture ajoutées aux trois tables (autorisé). Un test de M1 a été adapté : un simple connecté qui tente une modification est maintenant arrêté par la RLS (0 ligne touchée) au lieu d'une erreur de privilège.
