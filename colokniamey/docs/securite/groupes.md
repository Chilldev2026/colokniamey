# Groupes de colocation (module M8)

Des étudiants se regroupent pour louer ensemble un logement publié par un **propriétaire** (RG34 à RG39).

## Règles appliquées par la base (`1010_groupes.sql`)

| Règle | Où |
|---|---|
| RG34 : seul un étudiant lance un groupe, sur un logement **publié par un propriétaire** ; places recherchées entre 1 et `nb_places - 1` | `creer_groupe()` |
| RG52, RG59 : l'étudiant doit avoir une identité vérifiée (toujours vrai tant que le KYC est désactivé) pour lancer **et** pour rejoindre | `exiger_etudiant_verifie()` |
| RG36 : adhésion sur demande ; **un seul groupe actif par logement et par étudiant** ; au plus `groupes_actifs_max` groupes actifs (3 par défaut [À VALIDER], paramètre non public) | `demander_adhesion()`, `verifier_participation()` |
| RG36 : seul l'**initiateur** répond à une demande | `repondre_demande()` |
| RG38 : le groupe passe à **complet** quand tous les membres sont acceptés (déclencheur) ; membres et propriétaire notifiés ; un groupe complet n'accepte plus de demandes et on ne peut pas dépasser les places | `mettre_a_jour_groupe()` |
| RG39 : si l'initiateur part, le **plus ancien membre accepté** le remplace ; sans autre membre, le groupe se clôt ; un groupe complet qui perd un membre redevient « en formation » | `quitter_groupe()` |
| RG39 : **clôture automatique** quand l'annonce n'est plus publiée ou après 30 jours sans activité (pg_cron `m8-cloture-groupes`, 3 h UTC) | `cloturer_groupes_inactifs()` |
| RG37 : part estimée = loyer total ÷ nombre de places (le loyer d'un propriétaire est son loyer mensuel) | `groupes_du_logement()` |

Le message et les préférences du groupe passent par le contrôle de S (RG45). Aucune écriture directe : les tables n'ont que des droits de lecture.

## Qui voit quoi (RLS)

- Groupes **en formation** sur une annonce publiée : tout utilisateur **connecté**. Le propriétaire voit aussi les groupes complets de son annonce (onglet « Groupes intéressés »). Un membre voit les siens, même clos.
- Membres : prénom et initiale seulement (profil public minimal). Les **demandes en attente** ne sont visibles que de l'initiateur et du demandeur.
- Les politiques passent par des fonctions d'aide (`peut_voir_groupe`, `est_initiateur_groupe`) pour éviter les boucles entre politiques.
- Un visiteur ne lit rien ; seul un **nombre** de groupes en formation est public (badge, RG24).

## Intégrations

- **M4** : le détail d'une annonce affiche la section « groupes » par un point d'extension (`src/core/extensions.ts`) : M4 n'importe pas M8, et sans M8 la page fonctionne. Pour qu'un logement de propriétaire accueille un groupe, l'annonceur renseigne désormais le **nombre de colocataires** que le logement peut accueillir (`nb_places`).
- **M5** (`1011_recherche_groupes.sql`) : filtre « colocations en formation », badge « N groupes cherchent des colocataires » sur les cartes de la liste, marqueur distinct sur la carte (couleur indigo) et mention dans l'aperçu.

## Droits (RGP17)

`creer_groupe`, `demander_adhesion`, `repondre_demande`, `quitter_groupe`, `groupes_du_logement`, `membres_du_groupe`, `mes_groupes` : `authenticated` (le corps vérifie le rôle, l'identité et la participation). `compter_groupes_en_formation` et `compter_groupes_annonces` : tous, car ils ne renvoient qu'un nombre. Aides utilisées par les politiques : `peut_voir_groupe`, `est_initiateur_groupe`. Le reste est interne.

## Limites connues

- **Conversation de groupe** : M6 est une messagerie à deux personnes ; la discussion de groupe (facultative dans le prompt) n'est pas développée. Les membres se contactent par la messagerie, un à un.
- Quand l'initiateur accepte une demande, il ne peut pas encore la commenter. Les groupes ne sont pas modifiables après création (message, préférences) : il faut en recréer un.
- La limite de groupes actifs (3) et le délai de clôture (30 jours) sont à valider ; elle se change dans la table `parametres` (clé `groupes_actifs_max`).
