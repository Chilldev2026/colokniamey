# Signalements (module M7 et volet d'A3)

## Signaler (RG20, RGP20)

`signaler(type, id, motif, commentaire)` : annonce, profil ou message. La base vérifie que le contenu est **visible** par la personne, interdit de **se signaler soi-même** et d'envoyer un **doublon** (un seul signalement ouvert par auteur et par cible), et limite à **10 signalements par jour**. Il n'y a **aucune écriture directe** dans la table. Le commentaire passe par le contrôle de S (blocage seulement, car seuls les admins le lisent). Motifs : arnaque, contenu inapproprié, fausse annonce, harcèlement, autre.

L'auteur lit ses signalements (statut, motif, commentaire) ; il ne voit ni l'admin qui s'en occupe, ni la copie du message. La personne signalée n'est **pas prévenue** et ne voit rien.

## Messages privés (RGA10)

Signaler un message ne donne **pas** accès à la conversation. On ne signale qu'un message **reçu**, dans une conversation dont on fait partie, et la base enregistre **une copie de ce seul message** (contenu, date). L'admin lit cette copie et rien d'autre : aucune politique ne lui ouvre `messages` ou `conversations`, et le test SQL le vérifie.

## Côté admin (volet signalements d'A3) : `/admin/signalements`

| Fonction | Rôle |
|---|---|
| `liste_signalements(statut, motif)` | liste, le plus ancien d'abord, nombre de signalements sur la même cible |
| `fiche_signalement(id)` | cible en contexte (annonce, profil ou message joint), historique sur la même cible, autres signalements visant la même personne |
| `prendre_en_charge_signalement(id)` | **un seul admin** : la ligne est verrouillée, un second essai est refusé (RGA12) |
| `cloturer_signalement(id, décision, commentaire)` | seul l'admin qui l'a pris la rend |
| `relacher_signalement(id)` | remet dans la file |

États : `nouveau` → `en_cours` → `traite` ou `rejete` (RGA12). Décisions : **rejeter** ; **retirer l'annonce** (utilise la fonction d'A3 : motif obligatoire, notifié à l'auteur, RGA11) ; **suspendre l'auteur** (utilise A2 : motif obligatoire, refus sur soi-même ou un compte de niveau égal ou supérieur, RGA02) ; **marquer comme traité**. Chaque prise en charge et décision est journalisée (RGA06). L'auteur du signalement reçoit une notification neutre « signalement examiné » (RGA33).
La file `file_signalements` est inscrite dans `files_admin` : compteur du menu, alertes et relances (RGA29).

## Interface

- Bouton **Signaler** et formulaire modal réutilisables (`BoutonSignaler`, exporté par `index.ts`).
- Le détail d'une annonce (M4) reçoit « Signaler cette annonce » et « Signaler l'annonceur », et les messages reçus (M6) reçoivent « Signaler ce message », par les **points d'extension** `annonce-detail` et `message-actions` : ces modules n'importent jamais M7.
- `/signalements` : mes signalements et leur statut (lien depuis la page Compte).

## Droits (RGP17)

`signaler`, `signalement_ouvert` : `authenticated`. Les cinq fonctions d'admin : `authenticated`, avec `est_admin()` dans le corps (aal2 + session admin active). Export et compteurs : internes.

## Limites connues

- La personne signalée ne peut pas contester ; elle n'est pas informée (choix de confidentialité).
- Pas de signalement d'un groupe de colocation.
- Pas de limite de temps pour clore un signalement pris en charge : un admin peut le remettre dans la file, et l'alerte d'ancienneté d'A2 s'applique à la file « nouveau ».
