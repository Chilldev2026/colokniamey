# Modération (module A3)

Toutes les fonctions SQL du module exigent `est_admin()` (admin actif, jeton aal2, session admin active) ; celles qui touchent aux termes de validation exigent `est_super_admin()`. Masquer un bouton n'est jamais la seule protection (RGA27). Chaque décision est journalisée (RGA06), sans donnée personnelle ni terme sensible.

## Files de travail (RGA29)

| File | Vue | Écran | Contenu |
|---|---|---|---|
| Annonces à valider | `file_annonces` | `/admin/moderation` | annonces `en_attente`, la plus ancienne d'abord |
| Photos à valider | `file_photos` | `/admin/photos` | photos `en_attente` (avatars et annonces) |
| Contenus à vérifier | `file_contenus` | `/admin/contenus` | textes mis en revue par S |

Elles sont inscrites dans `files_admin` : compteurs du menu, alertes toutes les 15 minutes, récapitulatif du super-admin.

## Annonces (RG17, RGA11)

- `valider_annonce(id)` : publie. **Bloquée** tant qu'un texte de l'annonce est en revue (traiter d'abord le contenu).
- `refuser_annonce(id, motif)` et `retirer_annonce(id, motif)` : **motif de 3 à 300 caractères obligatoire**, communiqué à l'auteur par notification (déclencheur de M4). Un retrait passe l'annonce en « refusée » : l'auteur voit le motif et peut corriger.
- L'aperçu (`annonce_a_moderer`) donne tous les champs, les photos de tous statuts, les règles, tâches, équipements et la **position publique** (zone de 150 m ou point choisi) pour la carte. L'admin ne reçoit ni le téléphone ni le point exact (RGP01).
- Un admin ne décide pas de sa propre annonce.

## Photos (RG49, RG50)

Aperçu par adresse temporaire signée (10 minutes) du bucket privé `photos_en_attente`, lisible seulement par un admin aal2 (politique Storage ajoutée). Alerte si l'empreinte est déjà connue (`suspecte`). La décision passe par l'Edge Function `securite-photos-decision` de S, qui déplace le fichier.

## Contenus en revue (RG45)

`decider_contenu(id, publier, motif)` : *publier* remet `en_revue = false` ; *refuser* retire le contenu (annonce refusée avec motif, règle ou tâche supprimée, profession et centres d'intérêt du profil effacés) et notifie l'auteur. Types gérés : `annonce`, `annonce_regle`, `annonce_tache`, `profil`. **Un module futur qui utilise `controler_colonnes_texte` avec un nouveau type doit ajouter son cas dans `contenu_a_verifier` et `decider_contenu`.**

## Récidives (RG47)

`controler_texte()` (S) alerte déjà les admins au 3ᵉ blocage en 30 jours. L'écran « Contenus » liste les comptes concernés (prénom, initiale, nombre, date) avec un lien vers la fiche utilisateur, où l'admin peut suspendre (A2).

## Termes sensibles (RG46, RGA28)

- Tout admin **propose** un terme (`proposer_terme`) : il est enregistré avec `valide = faux`, donc **ignoré par `verifier_texte()`**. Les super-admins reçoivent une notification sans le terme (RGA33).
- Seul le super-admin **valide**, **modifie**, **désactive/réactive** ou **rejette** (`valider_terme`, `modifier_terme`, `definir_terme_actif`, `rejeter_terme`). Un terme proposé par un super-admin est validé d'office.
- **Confidentialité de la liste** : le super-admin voit toute la liste ; un admin ne voit que ses propres propositions. Aucun terme n'apparaît dans le journal ni dans une notification.
- Les termes en langues locales (haoussa, zarma, tamasheq…) sont à fournir par l'auteur : aucun n'a été inventé. Le champ « langue » est prévu.

## Correctifs de M4 découverts ici (`0971`)

- Un admin peut refuser l'annonce d'un auteur dont le compte est suspendu (le déclencheur ne vérifie plus que l'auteur est actif).
- Les annonces, photos et contacts d'un compte **suspendu ou désactivé** ne sont plus visibles du public (`auteur_actif()`).

## Droits (RGP17)

Toutes les fonctions listées sont accordées à `authenticated` et vérifient le rôle dans leur corps ; `motif_moderation` est interne (aucun GRANT).

## Limites connues

- « Une annonce validée apparaît dans la recherche » est testé sur la vue `annonces_publiques` ; l'écran de recherche arrive avec M5.
- La modération des signalements s'ajoute avec M7.
- Pas de modération de la photo d'une annonce depuis l'aperçu de l'annonce : elle se fait dans « Photos ».
