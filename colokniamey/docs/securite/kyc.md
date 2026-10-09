# Vérification d'identité (module K)

Développée et testée en entier, mais **désactivée par défaut** : paramètre `kyc_actif` = non (RG59). Le super-admin l'active dans **Pilotage → Paramètres**.

## Quand le KYC est désactivé (RG59)

- `identite_verifiee(uid)` renvoie vrai pour tout étudiant actif : M4 et M8 ne bloquent personne.
- Le parcours `/identite` affiche « pas demandée », le lien « Vérifier mon identité » du compte, le bandeau et le badge sont masqués, la file `/admin/identites` est absente du menu.
- `demarrer_kyc()`, `consentir_kyc()` et `kyc_preparer_depot()` refusent : aucune image n'est collectée.
- La photo de profil reste obligatoire (RG51). Désactiver le KYC n'efface pas les dossiers existants : ils suivent leur durée de conservation.

## Parcours d'un étudiant (RG51 à RG54)

1. Photo de profil validée par un admin (envoyée depuis « Mon profil », module M3).
2. **Consentement**, puis pièce d'identité recto et verso. Le consentement vient avant toute image.
3. Selfie pris **en direct** (caméra avant, aucun champ de fichier) avec le code à 4 chiffres écrit sur une feuille.
4. Envoi. Statuts : `non_soumis` → `en_attente` → `valide` ou `refuse` (motif obligatoire, communiqué). Trois dossiers au plus par 30 jours.

Le navigateur prépare chaque image avec le même code que toutes les photos (module S) : signature du fichier, analyse nsfwjs, ré-encodage WebP sans EXIF ni GPS, empreinte dHash. Elles ne sont jamais publiées.

## Où sont les images (RG55, RGP03)

- Bucket privé `kyc_prives` : **aucune politique** pour les utilisateurs (même pas le titulaire). Type `application/octet-stream`, 4 Mio maximum.
- `kyc-depot` (Edge Function) reçoit l'image, la **chiffre en AES-256-GCM** (IV aléatoire par fichier) avec la clé `KYC_CLE`, puis l'écrit sous `<user_id>/<dossier>/<recto|verso|selfie>.bin`.
- `kyc-consulter` (Edge Function) : un admin en `aal2` demande une image ; la base vérifie `est_admin()`, **journalise la consultation** (`kyc_consultation`), puis le serveur déchiffre et renvoie l'image directement (aucune URL, `Cache-Control: no-store`).
- Aucune donnée personnelle dans le journal : on y trouve l'action, l'identifiant du dossier et le nom de l'image.
- Ni numéro de pièce ni date de naissance ne sont enregistrés (RG56).

## Clé de chiffrement `KYC_CLE`

- Générée avec Node, sans jamais l'afficher, puis enregistrée comme secret des Edge Functions :
  `npx supabase secrets set KYC_CLE="<32 octets en base64>"`. Elle ne figure ni dans le code, ni dans Git, ni dans `.env`.
- **Si elle doit être changée** (soupçon de fuite, départ d'une personne ayant eu accès) :
  1. mettre le KYC en pause (`kyc_actif` = non) ;
  2. générer une nouvelle clé et refaire `secrets set` ;
  3. les images déjà déposées deviennent **illisibles** : refuser ces dossiers avec le motif « merci de renvoyer ton dossier » (ou attendre leur effacement automatique, 30 jours après la décision) ;
  4. réactiver le KYC.
- Si la clé est **perdue** : même conséquence, aucune image ne peut être récupérée. Les statuts « vérifié » restent valables, ils ne dépendent pas des images.

## Effacement (RG56) et annulation

- `kyc-purge` tourne chaque nuit (pg_cron `k-purge-images`, 2 h 30 UTC, pg_net, secret partagé `x-cron-secret`). Elle efface les images :
  - 30 jours après la décision [À VALIDER] ;
  - quand le consentement est retiré ;
  - d'un dossier jamais envoyé depuis 7 jours ;
  - d'un compte désactivé (RGA09).
- L'étudiant peut **annuler** tant que la décision n'est pas prise : `kyc-depot` (action `annuler`) retire le consentement et efface aussitôt les images ; la tâche de nuit sert de filet de sécurité.
- Les empreintes dHash restent après l'effacement (elles ne permettent pas de reconstituer l'image) ; elles servent à repérer une image déjà vue sur un autre compte.

## Dossier suspect (RG58)

Si une image a une empreinte presque identique (2 bits d'écart sur 64) à celle d'un autre compte, le dossier est marqué « déjà vu ailleurs » : l'admin le voit dans la file. C'est une alerte, jamais un refus automatique. Deux pièces d'identité du même modèle peuvent se ressembler : l'admin compare.

## Changement d'identité (RG57)

`identite_verifiee()` compare le nom, le prénom et l'empreinte de l'avatar **actuels** à ceux enregistrés à la validation. Tout changement fait repasser le statut à faux, sans déclencheur sur les tables de M3. L'étudiant en est informé dans son écran et peut déposer un nouveau dossier.

## Pour M4 et M8 (RG52)

- Dans une politique RLS ou une fonction : `public.identite_verifiee(auth.uid())` (autorisée pour `anon` et `authenticated`, ne renvoie qu'un booléen).
- Dans une fonction ou un déclencheur de M4 / M8 : `perform public.exiger_identite_verifiee();` (interne) avant de publier une `place_colocation`, de lancer ou de rejoindre un groupe.
- Côté interface : `BandeauIdentite` (invite à se faire vérifier) et `BadgeIdentite` (badge public, à placer dans l'emplacement `badge` de `CarteProfilPublic`), exportés par `@/modules/identite`.
- Propriétaires : concernés seulement si `kyc_actif` et `kyc_proprietaires` sont vrais.

## Droits (RGP17) : fonction → rôles

| Fonction | Rôle |
|---|---|
| `identite_verifiee(uuid)` | anon, authenticated (badge public) |
| `demarrer_kyc`, `consentir_kyc`, `soumettre_kyc`, `annuler_kyc`, `mon_kyc` | authenticated (le corps vérifie le compte actif et le paramètre) |
| `liste_dossiers_kyc`, `dossier_kyc_admin`, `autoriser_consultation_kyc`, `decider_kyc` | authenticated, mais `est_admin()` (aal2 + session admin) dans le corps |
| `kyc_preparer_depot`, `kyc_enregistrer_image`, `kyc_images_a_effacer`, `kyc_marquer_effacees` | service_role (Edge Functions) |
| `kyc_actif`, `identite_conforme`, `exiger_identite_verifiee`, `empreinte_avatar_actuel`, exports, compteurs, `declencher_purge_kyc` | internes, aucun GRANT |

## Limites connues

- Le test de bout en bout (dépôt chiffré, consultation, décision) avec de vrais comptes et une vraie caméra se fait à la main : voir la liste en fin de module.
- Si un compte est supprimé définitivement par le super-admin (RGA09), les images éventuellement restantes ne sont plus rattachées à un dossier : les effacer dans l'espace Storage de Supabase.
- Avant d'activer le KYC en production, la **politique de confidentialité** doit mentionner ce traitement (pièces d'identité, selfie, durée de conservation, accès restreint). Ces textes sont à valider par l'auteur : ils n'ont pas été modifiés.
- Pièces acceptées : CNI et passeport seulement [À VALIDER : autres pièces]. Conservation de 30 jours [À VALIDER].
