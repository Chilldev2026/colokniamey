# Annonces (module M4)

## Qui publie quoi (RG13, RG14)

- Un **propriétaire** publie une chambre, un studio ou un appartement. Un **étudiant** publie une place en colocation. La base refuse l'inverse (déclencheur `verifier_annonce`).
- Une annonce a un seul auteur, qui ne peut jamais changer.
- Limites : 30 annonces non archivées par personne, 10 créations par jour (`verifier_quota`).

## Cycle de vie (RG17)

`brouillon` → `soumettre_annonce()` → `en_attente` (si le paramètre `validation_annonces` est vrai) ou `publiee` → `refusee` ou `archivee`.

- L'auteur **ne peut pas fixer le statut lui-même** : le droit d'écriture sur cette colonne n'existe pas, tout passe par `soumettre_annonce`, `archiver_annonce`, `rouvrir_annonce` (et, plus tard, par la modération A3).
- **Modifier une annonce publiée la renvoie en attente** : champs de l'annonce, équipements, règles et tâches. Si la validation est désactivée, elle reste publiée.
- Modifier une annonce refusée la remet en brouillon (à soumettre de nouveau).
- Chaque changement de statut notifie l'auteur (`notifier()`) ; le motif d'un refus est communiqué (RGA11).
- Une place en colocation exige `identite_verifiee()` à la soumission (RG52). Tant que le KYC est désactivé (RG59), c'est toujours vrai.

## Position (RG21 à RG23)

- **Pas de soumission sans position** et **pas de point hors de la zone de la ville** : contrôlés par le déclencheur.
- La colonne `position` (point exact) est une donnée personnelle : **aucun rôle ne peut la lire** (droits de colonne). Conséquence : un `select *` sur `annonces` est refusé ; les services listent leurs colonnes.
- L'auteur relit son point par `position_annonce(id)`. Le public lit `position_publique` : en précision **approximative** (défaut), le point exact est ramené sur une grille de 0,0015° (environ 165 m) et la zone affichée a un rayon de 150 m ; en précision **exacte**, c'est le point lui-même.
- La vue `annonces_publiques` (`security_invoker`) est la porte d'entrée de M5 : latitude et longitude publiques, rayon de la zone, distance à l'université (calculée sur la position publique, arrondie à 10 m, RG25), photo principale.

## Photos (RG18, RG48 à RG50)

- Les photos passent par `EnvoiPhoto` de S (espace privé, validation admin). `photos_annonces` relie une photo à une annonce, avec un ordre.
- Le déclencheur limite à `photos_max` (5 par défaut), vérifie que la photo appartient à l'auteur, est d'usage « annonce » et n'a pas été refusée.
- Le public ne voit que les photos **validées**, par `photos_annonce(id)`.
- Retirer une photo supprime le lien, pas le fichier (ni la ligne `photos`). Le nettoyage des fichiers orphelins est à prévoir.

## Textes (RG45)

Titre et description (contexte `public`, avec mise en revue possible), règles et tâches (idem, colonne `en_revue`). Une annonce mise en revue est masquée du public jusqu'à la décision d'un admin (A3). Les services appellent `controlerTexte()` avant d'écrire pour journaliser les blocages (RG47).

## Contact (RG32, RGP20)

`contact_annonce(id)` : connectés seulement, **30 consultations par jour**. Le numéro vient du profil (RG11) ; l'appel et WhatsApp ne sont fournis que si l'auteur les a autorisés. Un numéro à 8 chiffres sans indicatif reçoit +227 [À VALIDER]. La messagerie interne (M6) sera ajoutée au détail par M6.

## Droits (RGP17) : fonction → rôles

| Fonction | Rôle |
|---|---|
| `photos_annonce`, `photo_principale_annonce` | anon, authenticated (photos validées d'annonces publiées) |
| `position_annonce`, `soumettre_annonce`, `archiver_annonce`, `rouvrir_annonce`, `contact_annonce` | authenticated (le corps vérifie l'auteur ou la connexion) |
| `verifier_annonce`, `notifier_statut_annonce`, `limiter_lignes_annonce`, `annonce_enfant_modifiee`, `verifier_photo_annonce`, exports, compteurs | internes, aucun GRANT |

## Pour M5, M6, M8 et A3

- M5 : lire `annonces_publiques` ; ne jamais lire `position`.
- M8 : appeler `exiger_identite_verifiee()` (voir K) pour lancer ou rejoindre un groupe sur une annonce.
- A3 : décider une annonce en mettant à jour `statut` (et `motif_refus`) avec un admin aal2 ; la notification et la visibilité suivent seules.

## Limites connues

- La liste des équipements est vide tant que l'auteur ne l'a pas saisie dans l'espace admin (Référentiel).
- Le réordonnancement des photos, règles et tâches se fait avec des boutons, pas par glisser-déposer (plus accessible au clavier et au toucher).
- Les photos retirées ne sont pas effacées du stockage.
