# Messagerie (module M6)

## Confidentialité (RGA10, RGP01)

Les messages sont **confidentiels**. Seuls les deux participants lisent une conversation (RLS sur `conversations` et `messages`). **Il n'existe aucune politique pour les admins**, et le test SQL vérifie qu'un admin aal2 ne voit rien. Aucune modification ni suppression de message n'est possible (droits de colonnes : seul l'envoi est autorisé).
Le futur module M7 (signalements) donnera accès aux seuls messages joints à un signalement, par une fonction dédiée.

## Fonctionnement

- `demarrer_conversation(annonce, message)` (RG19) : annonce **publiée**, non en revue, auteur actif ; pas de conversation avec soi-même ; une seule conversation par annonce et par demandeur (la même est reprise). 20 nouvelles conversations par jour.
- Envoi : insertion dans `messages` (droit sur `conversation_id` et `contenu` seulement ; l'expéditeur est toujours la personne connectée). **20 messages par minute et 200 par jour** (`verifier_quota`), 2000 caractères au plus, refus si l'autre personne n'est plus active ou en maintenance (`peut_ecrire`).
- Texte : contexte S « privé » = **blocage seulement**, jamais de mise en revue ; le terme détecté n'est pas affiché. L'interface appelle `controler_texte` avant l'envoi pour journaliser un blocage (RG47).
- Notification : l'autre personne est prévenue **une fois par série de messages non lus**, sans le texte du message.
- `liste_conversations()` : prénom et initiale de l'autre personne, titre de l'annonce si elle est encore visible, nombre de non lus. `marquer_lu(id)` et `mes_messages_non_lus()`.
- Une conversation survit à la suppression de l'annonce (« Annonce retirée »).

## Temps réel (RGP23)

L'écran de conversation s'abonne aux **changements de la table `messages`** (publication Realtime, filtre `conversation_id`). Comme la RLS s'applique aux abonnements, **un tiers abonné ne reçoit aucun message**. Aucun canal public, aucun canal broadcast ou presence : l'indicateur « en train d'écrire » n'est pas développé (il demanderait un canal privé et des politiques sur `realtime.messages`).
Le test SQL vérifie que `messages` est dans la publication et `conversations` n'y est pas ; l'isolation de la réception elle-même se vérifie à la main avec deux navigateurs (voir la liste de captures).

## Interface

`/messages` (liste), `/messages/:id` (fil en temps réel, envoi avec Entrée, marquage comme lu), `/messages/nouveau/:annonceId` (premier message prérempli). Sur le détail d'une annonce, « Envoyer un message » est toujours proposé à une personne connectée qui n'est pas l'auteur ; WhatsApp et Appeler restent facultatifs (RG32).

## Droits (RGP17)

`demarrer_conversation`, `ma_conversation_annonce`, `liste_conversations`, `marquer_lu`, `mes_messages_non_lus` : `authenticated` seulement (le corps vérifie la participation). `verifier_message`, `apres_message`, `exporter_donnees_messagerie` : internes, aucun GRANT.

## Limites connues

- Pas d'indicateur « en train d'écrire », pas de pièces jointes, pas de blocage d'un utilisateur ni de suppression de conversation (hors périmètre).
- À la désactivation d'un compte, les messages restent visibles de l'autre personne, sous le nom « Ancien membre ».
- La pastille de non lus du menu n'est pas affichée (la fonction `mes_messages_non_lus` est prête).
