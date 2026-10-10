# Résultats des tests d'attaque (RGP17 à RGP27)

Pièce pour le mémoire (F1). Script : `npm run test:attaques` (`scripts/attaques.mjs`), exécuté le 10 octobre 2026 contre le projet Supabase en ligne avec **la seule clé publique** (jamais la clé service_role). Aucune donnée n'est créée.

| Règle | Test | Résultat attendu | Résultat obtenu | Verdict |
|---|---|---|---|---|
| RGP22 | admin-recapitulatif : appel sans jeton | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | admin-recapitulatif : mauvais secret partagé | 401 | 401 | réussi |
| RGP22 | admin-utilisateurs : appel sans jeton | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | admin-utilisateurs : clé publique comme jeton (pas un utilisateur) | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | admin-utilisateurs : origine non autorisée | 401 ou 403 (404 : non déployée) | 403 | réussi |
| RGP22 | admin-utilisateurs : méthode GET | refusée (4xx) | 405 | réussi |
| RGP22 | core-envoyer-email : appel sans jeton | 401 ou 403 (404 : non déployée) | 404 | réussi |
| RGP22 | core-envoyer-email : clé publique comme jeton (pas un utilisateur) | 401 ou 403 (404 : non déployée) | 404 | réussi |
| RGP22 | core-envoyer-email : origine non autorisée | 401 ou 403 (404 : non déployée) | 404 | réussi |
| RGP22 | core-envoyer-email : méthode GET | refusée (4xx) | 404 | réussi |
| RGP22 | kyc-consulter : appel sans jeton | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | kyc-consulter : clé publique comme jeton (pas un utilisateur) | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | kyc-consulter : origine non autorisée | 401 ou 403 (404 : non déployée) | 403 | réussi |
| RGP22 | kyc-consulter : méthode GET | refusée (4xx) | 405 | réussi |
| RGP22 | kyc-depot : appel sans jeton | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | kyc-depot : clé publique comme jeton (pas un utilisateur) | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | kyc-depot : origine non autorisée | 401 ou 403 (404 : non déployée) | 403 | réussi |
| RGP22 | kyc-depot : méthode GET | refusée (4xx) | 405 | réussi |
| RGP22 | kyc-purge : appel sans jeton | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | kyc-purge : mauvais secret partagé | 401 | 401 | réussi |
| RGP22 | securite-photos-decision : appel sans jeton | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | securite-photos-decision : clé publique comme jeton (pas un utilisateur) | 401 ou 403 (404 : non déployée) | 401 | réussi |
| RGP22 | securite-photos-decision : origine non autorisée | 401 ou 403 (404 : non déployée) | 403 | réussi |
| RGP22 | securite-photos-decision : méthode GET | refusée (4xx) | 405 | réussi |
| RGP04 | lecture publique de annonce_equipements | données publiques seulement | 200 | réussi |
| RGP04 | lecture publique de annonces | données publiques seulement | 401 | réussi |
| RGP04 | lecture publique de equipements | données publiques seulement | 200 | réussi |
| RGP04 | lecture publique de quartiers | données publiques seulement | 200 (lignes publiques) | réussi |
| RGP04 | lecture publique de regles_annonce | données publiques seulement | 200 | réussi |
| RGP04 | lecture publique de taches_annonce | données publiques seulement | 200 | réussi |
| RGP04 | lecture publique de universites | données publiques seulement | 200 (lignes publiques) | réussi |
| RGP04 | lecture publique de villes | données publiques seulement | 200 (lignes publiques) | réussi |
| RGP04 | lecture publique de annonces_publiques | données publiques seulement | 200 | réussi |
| RGP04 | lecture publique de quartiers_geo | données publiques seulement | 200 (lignes publiques) | réussi |
| RGP04 | lecture publique de universites_geo | données publiques seulement | 200 (lignes publiques) | réussi |
| RGP04 | lecture publique de villes_geo | données publiques seulement | 200 (lignes publiques) | réussi |
| RG23 | lecture de la colonne position (point exact) | refusée | 401 | réussi |
| RGP04 | écriture dans annonces par un visiteur | refusée (4xx) | 401 | réussi |
| RGP04 | suppression de profils par un visiteur | refusée (4xx) | 401 | réussi |
| RGP17 | appel de journaliser() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de notifier() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de verifier_texte() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de normaliser_texte() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de consommer_quota() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de alertes_files() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de taches_planifiees() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de anonymiser_compte() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de admin_action_suspendre() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de kyc_enregistrer_image() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de kyc_images_a_effacer() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de kyc_preparer_depot() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de cloturer_groupes_inactifs() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de exporter_donnees_profils() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de declencher_recapitulatif() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de identite_conforme() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de exiger_identite_verifiee() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de mettre_a_jour_groupe() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de valider_annonce() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de decider_kyc() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de decider_photo() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de definir_maintenance() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de modifier_parametre() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de valider_terme() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de liste_utilisateurs() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de liste_signalements() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de demarrer_conversation() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de creer_groupe() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de soumettre_annonce() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de contact_annonce() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de exporter_mes_donnees() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de signaler() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP17 | appel de mon_kyc() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de liste_conversations() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de mes_favoris() par un visiteur | 401, 403 ou 404 | 401 | réussi |
| RGP17 | appel de position_annonce() par un visiteur | 401, 403 ou 404 | 404 | réussi |
| RGP19 | inscription sans jeton Turnstile | 400 « captcha » | 400 (captcha exigé) | réussi |
| RGP19 | connexion sans jeton Turnstile | 400 « captcha » | 400 (captcha exigé) | réussi |
| RGP21 | lecture publique du bucket kyc_prives | 400 ou 404 (bucket privé) | 400 | réussi |
| RGP21 | liste du bucket kyc_prives par un visiteur | vide ou refusée | 200 | réussi |
| RGP21 | lecture publique du bucket photos_en_attente | 400 ou 404 (bucket privé) | 400 | réussi |
| RGP21 | liste du bucket photos_en_attente par un visiteur | vide ou refusée | 200 | réussi |
| RGP21 | envoi direct dans photos_publiques par un visiteur | refusé (4xx) | 400 | réussi |

82 test(s) réussi(s) sur 82.
