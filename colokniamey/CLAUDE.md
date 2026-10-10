# ColokNiamey — instructions pour Claude Code

## Le projet
ColokNiamey est une application web progressive (PWA) qui met en relation les étudiants pour la colocation à Niamey (Niger). Elle cible d'abord Niamey, notamment l'Université Abdou Moumouni, sans exclure les universités de l'intérieur du pays.
C'est le projet du mémoire de fin de cycle (Licence professionnelle en génie logiciel, IAT) : l'auteur doit pouvoir expliquer chaque ligne en soutenance.
Le document de référence s'intitule « ColokNiamey — Modules et prompts de développement ». Il contient un prompt par module.

## Pile technique (imposée) : 100 % TypeScript
- Frontend : Vue 3 (`<script setup lang="ts">`), Vite, Vue Router, Pinia, vite-plugin-pwa, @supabase/supabase-js, chart.js + vue-chartjs (tableaux de bord admin).
- Backend : **Supabase uniquement**, c'est-à-dire Auth (avec MFA TOTP pour les admins), PostgreSQL avec RLS, Storage, Realtime et Edge Functions en TypeScript (Deno).
- **Aucun serveur applicatif.** Ne jamais réintroduire Laravel, Express ni aucun autre backend.
- Coût : 0 $. Uniquement des services gratuits.

## Environnement
- Windows, Node.js 24.11.0, npm, Git et GitHub. Supabase CLI via `npx supabase`.
- Dossier, et racine du dépôt : `C:\Users\ITN\Documents\DevBranch\Framework\colokniamey`
- Les commandes doivent fonctionner sous Windows (cmd ou PowerShell).

## Organisation modulaire
```
colokniamey/
├── CLAUDE.md
├── src/
│   ├── core/            # M0 : client Supabase, layout, UI, notifications, capture visites/erreurs, maintenance
│   ├── modules/
│   │   ├── securite/ referentiel/ auth/ profils/ identite/ annonces/ recherche/ messagerie/ groupes/ signalements/ avis/
│   │   └── admin/       # utilisateurs/ plateforme/ audit/ moderation/ communiques/ tableau-de-bord/
│   └── app/             # modules.ts (modules actifs), router et menu construits à partir de cette liste
└── supabase/
    ├── migrations/      # préfixées par module : 0100_core, 0200_referentiel, 0300_auth…
    ├── seed.sql
    └── functions/       # préfixées par module : admin-utilisateurs…
```
Chaque module contient : `index.ts` (son contrat public : routes, menu, API), `routes.ts`, `services/` (seul endroit qui appelle Supabase), `stores/`, `views/`, `components/`, `types.ts` et `__tests__/`.

**Contrat d'indépendance d'un module**
1. Il n'expose que ce que déclare son `index.ts`. Ses fichiers internes ne sont jamais importés ailleurs.
2. Il ne dépend que de `core` et de l'`index.ts` de ses dépendances déclarées.
3. Il possède ses tables et ses migrations, et ne modifie jamais les tables d'un autre module. Seule exception : un module admin peut ajouter des politiques RLS de lecture ou d'administration sur les tables du module qu'il gère.
4. Il s'active ou se désactive dans `src/app/modules.ts`. L'application compile et fonctionne même sans les modules optionnels.
5. Il est **terminé** quand ses migrations sont appliquées, ses politiques RLS testées par script SQL, `npm run type-check` et ses tests au vert, et son commit poussé.

## Ordre de développement
**Phase 1 — noyau prioritaire**
1. M0 Socle et PWA installable
2. D Identité visuelle (après validation des maquettes)
3. M1 Référentiel géographique
4. M2 Comptes et authentification
5. S Sécurité du contenu (textes et photos)
6. M3 Profils
7. A2 Utilisateurs et accès admin (deux coques /admin, admin et super-admin, + MFA)
8. A5 Plateforme et maintenance
9. K Vérification d'identité (KYC des étudiants)
10. M4 Annonces et localisation
11. A3 Modération (annonces, photos, contenus en revue, termes sensibles)
12. M5 Recherche, carte et favoris
13. M6 Messagerie
14. M8 Groupes de colocation
15. M7 Signalements (+ volet signalements d'A3)
16. F1 Livraison du noyau (tests, déploiement, installation réelle)

**Calendrier : fin du développement le 15 novembre 2026, puis rédaction du rapport.**

**Phase 2 — extensions (seulement si la phase 1 est terminée en avance ; commencer par A1, sinon perspectives)**
17. A6 Audit et erreurs
18. A4 Communiqués
19. A1 Tableau de bord et statistiques
20. F2 Finalisation complète

**Axes d'amélioration — NE PAS DÉVELOPPER avant la fin de F1**
- M9 Avis et notes (règles RG40 à RG44 conservées pour plus tard).
- Notifications push (Web Push) : `abonnements_push`, `envoyer-push`, clés VAPID.
- Paiement local (mobile money, séquestre de la caution) via un agrégateur ; au Niger, FedaPay et Moneroo n'indiquent qu'Airtel Money [À VÉRIFIER]. Autre piste : NITA (MyNita), sans API publique trouvée [À VÉRIFIER : partenariat à demander]. Aucune table ni écran de paiement à créer maintenant.

**K est développé et testé, mais désactivé par défaut** : paramètre `kyc_actif` = faux (RG59).

## Identité visuelle (module D) : « Banco et indigo »
- Couleurs :
  - fond gris très clair #F5F6F8 ; surfaces blanches #FFFFFF ;
  - encre #14161B ; texte secondaire #5B6270 ; bordures #E3E6EC ; bordures des champs #D3D8E0 ;
  - indigo touareg #1E3966 (couleur principale) ;
  - orange du Niger #C4520F (boutons, texte blanc) et #E8661C (décor uniquement) ;
  - vert #2C7A4B (validation) ; terre cuite #B8643E.
- Polices : Bricolage Grotesque (titres, 700-800) et Atkinson Hyperlegible (texte), auto-hébergées avec @fontsource.
- Motifs, utilisés avec retenue : ruban de triangles (tissages et cuirs du Sahel), croix d'Agadez stylisée, losanges des reliefs haoussa en banco.
- Interdits :
  - dégradés décoratifs, emojis comme icônes, cartes à bordure colorée à gauche ;
  - **toute ombre portée** : la profondeur vient des fonds et des bordures fines ;
  - **les effets au survol** : l'application est d'abord tactile ; sur ordinateur, le survol peut seulement changer légèrement une couleur, jamais révéler une information ou une action ;
  - les polices Inter, Roboto et Arial.
- **Animations : l'application doit paraître vivante**
  - Outils : `<Transition>` et `<TransitionGroup>` de Vue, plus l'API Web Animations, via un composable `useAnimation`. Pas de bibliothèque lourde.
  - Durées en jetons : 150 ms (rapide), 250 ms (normal), 400 ms (lent), courbe ease-out.
  - Animations prévues :
    - transitions glissantes entre les pages, dans le sens de la navigation ;
    - cartes d'annonce qui apparaissent en cascade ;
    - feuille du bas avec un léger rebond, fermée en la tirant vers le bas ;
    - marqueurs qui tombent sur la carte ;
    - pulsation pendant la localisation GPS, puis cercle de précision qui se resserre ;
    - léger enfoncement des boutons au toucher ;
    - cœur des favoris qui bat ;
    - squelettes de chargement à la place des spinners ;
    - compteurs admin qui défilent, barre de progression qui s'étire, toasts qui glissent ;
    - places d'un groupe de colocation qui se remplissent.
  - Règles :
    - animer seulement `transform` et `opacity` ;
    - aucune animation ne retarde une action ;
    - tout est désactivé si l'utilisateur a activé `prefers-reduced-motion`.
- Icônes : Lucide uniquement (SVG en ligne, trait de 2 px, couleur du texte).
- Graphiques des tableaux de bord : Chart.js avec vue-chartjs, composants partagés `GraphiqueCourbe` (line, tension 0.35, trait 2 px) et `GraphiqueCirculaire` (doughnut, total au centre) dans `src/core/ui/graphiques`. Couleurs des séries, dans cet ordre : #3A66B0, #E0731F, #3E9B6B, #B05A9A ; gris #8A93A3 pour une catégorie « autres / refusées ». Jamais deux échelles verticales sur un graphique ; légende dès deux séries ; tableau des valeurs accessible sous chaque graphique ; animation 400 ms coupée si `prefers-reduced-motion`.
- Cartes de statistiques : icône Lucide dans une pastille de 36 px, libellé, valeur, ligne d'évolution ; la carte « à valider » est mise en avant en orange.
- Accessibilité : contraste du texte ≥ 4,5:1, cibles tactiles ≥ 44 px, textes en tutoiement.
- Référence : les maquettes « ColokNiamey — Maquettes des écrans ».

**Avancement**
- [x] Projet Vue 3 + TS créé, dépôt GitHub `colokniamey`, nouveau projet Supabase
- [x] M0 Socle et PWA
- [x] D Identité visuelle
- [x] M1 Référentiel géographique
- [x] M2 Comptes et authentification
- [x] S Sécurité du contenu (textes et photos)
- [x] M3 Profils
- [x] A2 Utilisateurs et accès admin
- [x] A5 Plateforme et maintenance
- [x] K Vérification d'identité (développé et testé, désactivé par défaut)
- [x] M4 Annonces et localisation
- [x] A3 Modération (annonces, photos, contenus, termes sensibles)
- [x] M5 Recherche, carte et favoris
- [x] M6 Messagerie
- [x] M8 Groupes de colocation
- [x] M7 Signalements (avec le volet signalements d'A3)
- [ ] F1 … (cocher au fur et à mesure)

## Rôles
`etudiant`, `proprietaire`, `admin`, `super_admin`. Une inscription ne peut créer qu'un `etudiant` ou un `proprietaire`. Le premier super-admin est créé par script SQL.

## Règles de gestion
**Utilisateurs et contenus**
*(Les règles RG21 à RG25 de la carte suivent la liste RG01 à RG20 ci-dessous.)*
- RG01 : e-mail unique.
- RG02 : un seul rôle par utilisateur.
- RG03 : le rôle admin est interdit à l'inscription.
- RG04 : mot de passe d'au moins 8 caractères, haché par Supabase Auth.
- RG05 : un seul profil par rôle.
- RG06 : un étudiant est rattaché à une université.
- RG07 : une université appartient à une ville.
- RG08 : un compte suspendu ne peut pas se connecter.
- RG09 : seul un admin suspend un compte.
- RG10 : chacun ne modifie que son propre profil.
- RG11 : téléphone obligatoire.
- RG12 : la déconnexion met fin à la session.
- RG13 : un propriétaire publie des logements, un étudiant des places en colocation.
- RG14 : une annonce a un seul auteur.
- RG15 : une annonce est rattachée à un quartier et éventuellement à une université proche.
- RG16 : loyer en FCFA, supérieur à 0.
- RG17 : une annonce est validée par un admin avant publication si le paramètre l'exige.
- RG18 : nombre de photos limité par le paramètre `photos_max` (5 par défaut).
- RG19 : contact possible avec l'auteur d'une annonce publiée.
- RG20 : tout utilisateur peut signaler un contenu.

**Carte** (Leaflet + tuiles OpenStreetMap avec attribution, PostGIS)
- RG21 : une annonce doit être localisée avant d'être soumise, soit en direct avec le bouton « Localiser ma maison » (géolocalisation du téléphone, précision affichée, marqueur ajustable), soit par placement manuel sur la carte ; l'auteur confirme ensuite la position.
- RG22 : le point doit se trouver dans la zone de la ville (centre + rayon_km).
- RG23 : précision `exacte` ou `approximative` (par défaut) ; en mode approximatif, le public ne voit qu'une zone d'environ 150 m, jamais le point exact ; la colonne position n'est jamais lisible directement par le public.
- RG24 : seules les annonces publiées apparaissent sur la carte ; un clic ouvre l'aperçu, puis les photos et le détail.
- RG25 : les universités ont leur propre marqueur ; la distance annonce–université est affichée.
- RG25 bis : la position d'une université est facultative au chargement initial ; sans position, elle reste proposée à l'inscription mais n'a ni marqueur ni calcul de distance. Un admin la place ensuite sur la carte dans A5 (bouton « Placer sur la carte »). Aucune coordonnée n'est inventée.

**Contenu d'une annonce, défini par l'annonceur**
- RG28 : part mensuelle par colocataire ; pour une colocation, loyer total et nombre de places ; charges incluses ou montant estimé.
- RG29 : équipements cochés dans une liste gérée par l'admin (table `equipements` + `annonce_equipements`).
- RG30 : règles du logement (`regles_annonce`, 10 maximum, 120 caractères chacune).
- RG31 : tâches partagées (`taches_annonce`, 15 maximum), chacune avec une fréquence (quotidienne, hebdomadaire ou mensuelle) et un mode de répartition (tour de rôle, fixe, à discuter).
- RG32 : la messagerie interne est toujours disponible ; WhatsApp et l'appel sont optionnels, au choix de l'annonceur ; le numéro n'est fourni qu'aux utilisateurs connectés, via `contact_annonce()`.
- RG33 : durée de séjour minimale et maximale ; préférences facultatives (genre, tranche d'âge, étudiants uniquement), seulement affichées, jamais bloquantes.
- Profil de l'annonceur (M3) : profession et centres d'intérêt, facultatifs.

**Groupes de colocation (M8)** — tables `groupes_colocation` et `membres_groupe`
- RG34 : sur un logement publié par un propriétaire, un étudiant lance un groupe (places recherchées ≤ nombre de places − 1, préférences, message).
- RG35 : avant de lancer un groupe, il voit les groupes en formation sur ce logement et choisit d'en rejoindre un ou de créer le sien.
- RG36 : adhésion sur demande, acceptée par l'initiateur ; un seul groupe actif par logement et par étudiant ; N groupes actifs au maximum (N à valider).
- RG37 : part estimée = loyer total ÷ nombre de places.
- RG38 : un groupe complet n'accepte plus de demandes ; les membres et le propriétaire sont notifiés ; le propriétaire voit les groupes formés sur son logement.
- RG39 : un membre peut quitter le groupe ; l'initiateur sortant est remplacé par le plus ancien membre ; clôture automatique si le logement n'est plus publié ou après 30 jours sans activité.

**Avis et notes (M9) — axe d'amélioration, non développé pour la soutenance** — table `avis`
- RG40 : un utilisateur ne note qu'après une interaction réelle, vérifiée par `peut_noter()` : une conversation où chacun a écrit, ou un groupe complet commun. Jamais soi-même.
- RG41 : un seul avis par auteur et par cible ; une note de 1 à 5 et un commentaire de 20 à 500 caractères ; modifiable pendant 7 jours.
- RG42 : la personne notée peut répondre une fois ; elle ne peut ni modifier ni supprimer l'avis, mais elle peut le signaler.
- RG43 : la moyenne n'est affichée qu'à partir de 3 avis publiés ; avant, la mention « Nouveau ».
- RG44 : un avis mis en revue ou signalé reste masqué jusqu'à la décision d'un admin.

**Sécurité du contenu (S) — obligatoire pour TOUT texte et TOUTE photo enregistrés par un module**
- RG45 : chaque texte passe par `verifier_texte()` dans un déclencheur BEFORE INSERT/UPDATE. Trois issues : accepte, revue (contenu masqué, ligne ajoutée dans `contenus_en_revue`) ou bloque (exception en français, qui n'affiche jamais le terme détecté). Catégories : sexuel, haine ou racisme, terrorisme, violence, menace. Messages privés : blocage uniquement, jamais de mise en revue (RGA10).
- RG46 : la table `termes_sensibles` est gérée dans A3 (l'admin propose, le super_admin valide, RGA28). Le texte est normalisé avant comparaison (accents, majuscules, chiffres à la place de lettres, espaces et points insérés). Les termes en langues locales seront fournis par l'auteur.
- RG47 : chaque violation est journalisée ; au-delà de 3 blocages en 30 jours, les admins reçoivent une alerte.
- RG48 : photos JPEG, PNG ou WebP, contrôlées par la signature du fichier (pas par l'extension) ; ré-encodées en WebP dans un canvas, ce qui supprime les données EXIF et la position GPS.
- RG49 : analyse nsfwjs dans le navigateur, puis stockage dans le bucket privé `photos_en_attente`. Une photo n'est publiée dans `photos_publiques` qu'après validation par un admin (Edge Function `photos-decision`). Cela vaut aussi pour les avatars.
- RG50 : une empreinte dHash est calculée pour chaque photo ; une photo déjà refusée est bloquée, une photo déjà utilisée par un autre auteur est marquée comme suspecte.
- Toute photo passe obligatoirement par le composant `EnvoiPhoto` du module S. Aucun envoi direct vers Storage.

**Vérification d'identité (K) — KYC manuel et gratuit**
- RG51 : photo de profil obligatoire pour tout étudiant (visage visible, de face, sans filtre), validée par un admin (RG49). Sans elle, pas de dépôt KYC.
- RG52 : pour devenir colocataire (publier une place_colocation, lancer ou rejoindre un groupe), il faut `identite_verifiee()` = vrai. Recherche, carte, favoris et messagerie restent ouverts [À VALIDER : messagerie].
- RG53 : dossier = pièce officielle en cours de validité (CNI, passeport [À VALIDER : autres pièces]), recto et verso, + selfie pris EN DIRECT (getUserMedia, caméra avant, aucun import de fichier) en tenant une feuille avec le code à 4 chiffres généré par `demarrer_kyc()` ; consentement explicite.
- RG54 : statuts non_soumis → en_attente → valide | refuse (motif obligatoire, communiqué) ; 3 dossiers au plus par 30 jours.
- RG55 : bucket privé `kyc_prives`, aucune politique de lecture utilisateur (même pas le titulaire après envoi) ; dépôt par l'Edge Function `kyc-depot`, images chiffrées en AES-256-GCM (RGP03) ; consultation admin par `kyc-consulter` (aal2, déchiffre et renvoie l'image directement, aucune URL, `Cache-Control: no-store`, chaque consultation journalisée). Seul le badge « Identité vérifiée » est public.
- RG56 : ni numéro de pièce ni date de naissance enregistrés ; images effacées 30 jours après la décision [À VALIDER].
- RG57 : `identite_verifiee()` compare nom, prénom et empreinte de l'avatar actuels à ceux validés ; tout changement suspend le statut (sans déclencheur sur les tables de M3).
- RG58 : empreinte dHash de chaque image KYC ; une image déjà vue sur un autre compte marque le dossier suspect.
- RG59 : KYC désactivé par défaut (`kyc_actif` = faux) : `identite_verifiee()` renvoie vrai pour tout étudiant actif, écrans KYC et file `/admin/identites` masqués, aucune image collectée ; la photo de profil reste obligatoire (RG51). Activation par le super-admin seulement.
- Pré-traitement des images KYC par `EnvoiPhoto` en mode privé (signature, WebP sans EXIF/GPS, dHash), jamais publiées. Paramètres A5 : `kyc_actif` (faux par défaut, super-admin seulement, journalisé) et `kyc_proprietaires` (faux par défaut).

**Application mobile** (PWA, installée dès M0)
- RG26 : installable depuis le navigateur. Bouton « Télécharger l'application » (beforeinstallprompt) sur Android et ordinateur, guide Safari « Sur l'écran d'accueil » sur iPhone, page /installer avec QR code, bouton masqué si l'application est déjà installée.
- RG27 : notification de nouvelle version avec mise à jour en un clic ; page hors ligne au lieu d'une erreur.

**Administration**
- RGA01 : admin = modération et gestion des utilisateurs non admins ; super_admin = en plus, gestion des admins, des paramètres et de la maintenance.
- RGA02 : un admin n'agit jamais sur lui-même ni sur un compte de niveau égal ou supérieur.
- RGA03 : il reste toujours au moins un super_admin actif.
- RGA04 : l'espace admin exige le MFA ; les politiques d'administration vérifient le niveau `aal2` du jeton.
- RGA05 : le rôle admin n'est donné que par un super_admin.
- RGA06 : toute action admin passe par `journaliser()`.
- RGA07 : `journal_audit` est en ajout seul (UPDATE et DELETE impossibles).
- RGA08 : une suspension exige un motif ; la durée est facultative ; l'utilisateur est informé.
- RGA09 : la suppression d'un compte est une désactivation avec anonymisation ; la suppression définitive est réservée au super_admin.
- RGA10 : l'admin ne lit pas les messages privés, sauf ceux joints à un signalement.
- RGA11 : refuser ou retirer une annonce exige un motif, notifié à l'auteur.
- RGA12 : un signalement passe par les états nouveau → en_cours → traite ou rejete ; un seul admin le prend en charge.
- RGA13 : un communiqué a un niveau, une cible et une période d'affichage.
- RGA14 : un communiqué critique ne peut pas être masqué.
- RGA15 : la maintenance n'est activée que par un super_admin, avec un message et une heure de fin.
- RGA16 : en maintenance, seuls les admins accèdent à l'application et la base refuse les autres écritures (`peut_ecrire()`).
- RGA17 : les paramètres ne sont modifiés que par un super_admin, et chaque changement est journalisé.
- RGA18 : les statistiques de visite ne contiennent aucune donnée personnelle (ni IP, ni traceur tiers).
- RGA19 : les erreurs sont enregistrées sans données sensibles, regroupées par empreinte, avec un statut.
- RGA20 : conservation des visites détaillées 30 jours (puis agrégées par jour), des erreurs 90 jours ; journal d'audit conservé sans limite.

**Supervision : les quatre indicateurs** (mesures dans M0, tableaux dans A6)
- RGA21 : taux de requêtes (appels Supabase et pages vues, par minute, heure, jour et module).
- RGA22 : taux d'erreurs (global, par module et par page) ; alerte au-delà de 5 % sur 15 minutes (seuil à valider).
- RGA23 : temps de réponse P50, P95 et P99 (`percentile_cont`) ; P95 = ce que vivent les 5 % d'utilisateurs les plus lents, P99 = 1 % ; alerte au-delà d'un seuil à valider.
- RGA24 : saturation, c'est-à-dire taille de la base, stockage, connexions et appels aux Edge Functions comparés aux limites de l'offre gratuite ; alerte à 80 %.
- RGA25 : mesures anonymes et échantillonnées, envoyées par lots (`enregistrer_mesures()`) ; détail gardé 7 jours, puis agrégé par heure.
- Option : un tableau Grafana Cloud gratuit, en lecture seule, branché sur des vues d'agrégats.

**Admin et super-admin : droits et interfaces différents**
- RGA26 : deux coques distinctes, choisies selon le rôle. `CoqueSuperAdmin` : barre latérale encre #14161B, badge SUPER-ADMIN orange, sections Pilotage (Vue d'ensemble, Supervision technique, Administrateurs) et Opérations, accueil « Vue d'ensemble ». `CoqueAdmin` : barre latérale indigo #1E3966, badge ADMIN, menu de modération avec compteurs, accueil « Ma file de travail ». Chaque route admin déclare `meta.roles` ; le menu ne montre que les routes autorisées ; une route interdite renvoie vers l'accueil du rôle. Maquettes : `docs/maquettes/Admin` (super-admin) et `AdminModerateur` (admin).
- RGA27 : chaque droit est vérifié par la base (RLS, `est_admin()`, `est_super_admin()`) ou par l'Edge Function. Masquer un bouton n'est jamais la seule protection.
- RGA28 : un terme sensible proposé par un admin reste inactif jusqu'à validation par un super_admin ; un communiqué critique n'est créé que par un super_admin.
- Matrice :
  - admin et super_admin : modération (annonces, photos, contenus), vérification d'identité (KYC), signalements, suspension / réactivation / désactivation des étudiants et propriétaires, référentiel ;
  - super_admin seulement : suppression définitive, gestion des admins, validation des termes sensibles, communiqués critiques, paramètres et maintenance (l'admin les voit en lecture seule), supervision et erreurs, journal d'audit complet et exports CSV, statistiques complètes ;
  - admin : « Mon historique » (ses propres lignes d'audit) et `stats_moderation()` seulement.

**Notifications et relances des admins (RGA29 à RGA35)**
- RGA29 : nouvelle entrée dans une file (identités, annonces, photos, contenus, signalements) → notification dans l'app à chaque admin (push = axe d'amélioration) ; au plus une alerte par file toutes les 15 min [À VALIDER].
- RGA30 : e-mail automatique UNIQUEMENT au super-admin (récapitulatif quotidien + alertes urgentes), via Resend sans domaine vérifié : l'adresse du compte Resend est celle du super-admin. `envoyer-email` refuse tout autre destinataire tant que `email_domaine_verifie` est faux.
- RGA31 : le super-admin relance un admin ou tous (page Administrateurs ou file) : notification dans l'app + bandeau dans l'espace admin, puis au choix e-mail via SA propre messagerie (lien `mailto:` prérempli) ou WhatsApp (lien `https://wa.me/<numéro>?text=…` prérempli). Si `email_domaine_verifie` devient vrai, l'e-mail part directement de l'application.
- RGA32 : le bandeau reste jusqu'au clic « Vu » (`relances.vu_le`) ; le super-admin voit qui a vu et quand ; une relance max par admin et par heure ; chaque relance journalisée.
- RGA33 : aucune donnée personnelle dans une notification, un e-mail ou WhatsApp : file, nombre, ancienneté, lien vers l'espace admin (connexion + MFA).
- RGA34 : élément en attente depuis plus de 24 h [À VALIDER] → nouvelle alerte aux admins, en tête du récapitulatif du super-admin.
- RGA35 : préférences d'e-mail du super-admin ; les relances manuelles s'affichent toujours dans l'app.
- Contrat : chaque module à file (K, A3, M7) crée une vue `file_<nom>` (nombre en attente, plus ancien élément) et l'inscrit dans `files_admin` (A2). `alertes_files()` (A2) tourne toutes les 15 min (pg_cron si disponible).
- Infrastructure (M0) : notifications dans l'app par `notifier()` et Edge Function `envoyer-email` (`RESEND_API_KEY` en secret). Pas de Web Push (axe d'amélioration).

**Sessions et double authentification (RGA36 à RGA38, RGP28)**
- Sur l'offre gratuite, une session Supabase n'expire jamais (la limite d'inactivité de Supabase est réservée à Pro) : nous l'appliquons nous-mêmes.
- RGP28 : déconnexion après inactivité : étudiants 7 jours, propriétaires 14 jours. Composable `useInactivite` (core) : dernière action en stockage local (écriture ≤ 1/min), contrôle au démarrage, au `visibilitychange` et chaque minute ; délai dépassé → `signOut()` avant tout affichage.
- RGA36 : admins et super-admins : 30 min d'inactivité, sans durée maximale tant qu'ils restent actifs, vérifiées PAR LA BASE : table `sessions_admin` (session_id du jeton, user_id, derniere_activite), RPC `signaler_activite_admin()` (≤ 1 appel / 5 min), A2 étend `est_admin()` de M2 (CREATE OR REPLACE, seule modification autorisée d'un objet de M2). Avertissement « Déconnexion dans 2 minutes ». Code TOTP redemandé à chaque nouvelle connexion ; aucun « se souvenir de cet appareil ».
- RGA37 : invitation à enregistrer un deuxième appareil TOTP ; bandeau de rappel tant qu'il n'y en a qu'un.
- RGA38 : `reinitialiser_mfa` (Edge Function `admin-utilisateurs`) : super-admin seulement, motif obligatoire, jamais sur soi-même, autorisé sur un autre super-admin par exception à RGA02 ; journalisé et notifié à tous les super-admins.

## Fonctions SQL partagées
- Socle (M0) : `parametres_publics()`, `en_maintenance()`, `enregistrer_visite()`, `enregistrer_erreur()`, `journaliser()`, `notifier()`.
- Comptes (M2) : `est_actif()`, `est_admin()` (exige aal2), `est_super_admin()`, `peut_ecrire()`.
- Vérification d'identité (K) : `identite_verifiee(uid)`, utilisée par M4 et M8.

Toute politique d'écriture utilise `peut_ecrire()`.

## Conventions
- TypeScript strict, aucun `any`. Régénérer les types après chaque migration (`supabase gen types typescript`).
- La sécurité est assurée par la base (RLS, contraintes, déclencheurs). Les contrôles du formulaire ne servent qu'au confort.
- Les fonctions SQL `SECURITY DEFINER` déclarent toujours `set search_path = ''`.
- Textes, commentaires et erreurs en français. Mettre le numéro de règle en commentaire (`-- RGA07`, `// RG08`).
- Au moins un commit Git par module, avec un message clair en français.

## Sécurité : à respecter absolument
- Chaque fonction : aucun droit d'exécution public, GRANT explicite (RGP17). Chaque vue : `security_invoker = true` (RGP18). Chaque action répétable : `verifier_quota()` (RGP20).
- La clé `service_role` n'apparaît jamais dans le frontend ni dans Git. Elle n'existe que dans les secrets des Edge Functions.
- Ne jamais lire, afficher ni committer `.env`. Maintenir `.env.example` sans valeurs.
- Aucun `DROP`, `supabase db reset` ou suppression de données sans l'accord explicite de l'auteur.

## Protection et sécurité des données (RGP01 à RGP27)
Classification : très sensible = pièces et selfies KYC ; confidentiel = messages privés ; personnel = nom complet, e-mail, téléphone, position exacte ; interne = audit, erreurs, mesures ; public = prénom, initiale, rôle, université, photo validée, badge, annonces publiées.
- RGP01 : minimisation ; tout nouveau champ personnel est justifié dans le prompt de son module.
- RGP02 : HTTPS partout, HSTS chez l'hébergeur ; Supabase chiffre en TLS.
- RGP03 : Supabase chiffre au repos (AES-256) ; les images KYC sont EN PLUS chiffrées par l'application (AES-256-GCM, Web Crypto, IV aléatoire, clé `KYC_CLE` dans les secrets des Edge Functions).
- RGP04 : RLS sur 100 % des tables, refus par défaut ; SECURITY DEFINER avec `search_path = ''` et contrôle explicite du rôle ; un test échoue si une table de `public` n'a pas de RLS.
- RGP05 : `service_role` et `KYC_CLE` uniquement dans les secrets des Edge Functions ; analyse gitleaks avant chaque livraison ; toute clé exposée est changée.
- RGP06 : e-mail confirmé, mot de passe ≥ 8 (RG04), MFA admins, déconnexion de tous les appareils (`signOut({ scope: 'global' })`).
- RGP07 : en-têtes Content-Security-Policy (scripts du site seulement ; connect-src Supabase ; img-src tuiles OSM), `frame-ancestors 'none'`, Referrer-Policy `strict-origin-when-cross-origin`, Permissions-Policy limitée à camera (K) et geolocation (M4). Jamais de `v-html` sur un contenu utilisateur. Aucun traceur ni script tiers.
- RGP08 : le service worker ne met jamais en cache les réponses authentifiées, les images privées ni les messages.
- RGP09 : espaces de stockage privés par défaut ; EXIF et GPS supprimés (RG48).
- RGP10 : aucune donnée personnelle dans les journaux ; toute consultation d'une donnée sensible par un admin est journalisée.
- RGP11 : page « Mes données » (M3) : consulter, exporter en JSON (`exporter_mes_donnees()`), corriger, demander la suppression (RGA09).
- RGP12 : Politique de confidentialité et Conditions d'utilisation lisibles sans compte, acceptées à l'inscription (version et date enregistrées). Pages `/cgu` et `/confidentialite` alimentées par `src/core/legal/cgu.md` et `src/core/legal/confidentialite.md` (repris du document « ColokNiamey — CGU et Politique de confidentialité ») ; paramètre `version_cgu` : si la version acceptée est plus ancienne, une fenêtre bloque l'accès jusqu'à la nouvelle acceptation. Ne jamais réécrire ces textes sans l'auteur ; garder les marqueurs [INFORMATION MANQUANTE] et [À VALIDER].
- Éditeur (CGU et politique) : Chill & Dev Grp, nom du projet édité par AGBODO Ayao Fafanyo Benjamin (structure non immatriculée), Niamey, Niger — devchill132@gmail.com — +227 85 81 20 69 ou +227 77 10 20 05.
- RGP12 bis : le modèle nsfwjs, les polices et les icônes sont servis par le site lui-même, jamais par un serveur tiers. Seules les tuiles OpenStreetMap viennent de l'extérieur (déclaré dans la politique).
- K : `annuler_kyc()` retire le consentement avant la décision et efface aussitôt les images.
- RGP13 : l'offre gratuite de Supabase n'a pas de sauvegarde automatique : export hebdomadaire `supabase db dump`, chiffré, gardé hors de Supabase, restauration testée.
- RGP14 : procédure d'incident dans `docs/securite/incident.md` : maintenance, changement des clés, évaluation, notification à l'autorité et aux personnes concernées si risque élevé, journalisation.
- RGP15 : cadre légal : loi n° 2022-59 du 16 décembre 2022 modifiée par la loi n° 2023-31 du 4 juillet 2023, autorité HAPDP [RÉFÉRENCE À VÉRIFIER sur le texte officiel]. Ne rien affirmer de plus dans le code ou les textes.
- RGP16 : tests de sécurité en F1 : RLS par rôle, lecture de chaque table avec la seule clé publique, gitleaks, npm audit, analyse OWASP ZAP de l'adresse de production.

**Durcissement contre les attaques (RGP17 à RGP27) — obligatoire dès M0**
- RGP17 : PostgreSQL rend toute fonction exécutable par tous par défaut. Migration `0050_securite_base.sql` (la première) : `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated` + `ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated`. Puis un `GRANT EXECUTE` explicite par fonction, au seul rôle qui en a besoin. Fonctions internes (`journaliser`, `notifier`, `alertes_files`…) : aucun GRANT. Chaque SECURITY DEFINER vérifie le rôle de l'appelant. Chaque module donne sa liste « fonction → rôles autorisés ».
- RGP18 : toute vue est créée `WITH (security_invoker = true)`. Un agrégat qui doit franchir la RLS = fonction SECURITY DEFINER contrôlée, jamais une vue.
- RGP19 : Cloudflare Turnstile (gratuit) sur inscription, connexion, mot de passe oublié (`captchaToken`), clé publique `VITE_TURNSTILE_SITE_KEY`, clé secrète seulement dans Supabase.
- RGP20 : `verifier_quota(action)` (tables `limites`, `compteurs_quota`, M0) : 20 messages/min et 200/jour, 20 nouvelles conversations/jour, 30 `contact_annonce`/jour, 30 envois de photos/jour, 10 signalements et 10 avis/jour [À VALIDER]. RPC anonymes de mesure : taille limitée, limite par session et par minute, plafond global journalier.
- RGP21 : chaque bucket a `file_size_limit` et `allowed_mime_types` (jpeg, png, webp) ; écriture limitée au dossier `<user_id>/` ; `photos_publiques` et `kyc_prives` alimentés uniquement par Edge Function.
- RGP22 : toute Edge Function utilise `supabase/functions/_shared/securite.ts` : vérification du jeton et du rôle, CORS limité aux adresses de l'app (prod + localhost en dev), validation des entrées, taille limitée, erreurs génériques.
- RGP23 : Realtime : abonnements aux changements seulement sur tables avec RLS ; canaux broadcast/presence privés (`private: true`) + politiques sur `realtime.messages` ; accès public au Realtime désactivé.
- RGP24 : deux super-admins actifs [INFORMATION MANQUANTE : seconde personne] ou deux facteurs TOTP sur deux appareils ; `docs/securite/acces-urgence.md`.
- RGP25 : `supabase db dump` n'inclut pas le Storage : export hebdomadaire chiffré de `photos_publiques` ; `kyc_prives` jamais sauvegardé.
- RGP26 : messages génériques en connexion et mot de passe oublié ; rien de sensible dans le stockage du navigateur ; la détection des mots de passe fuités de Supabase est réservée à l'offre Pro → liste locale des mots de passe courants refusés.
- RGP27 : fin de chaque module : `supabase db lint` sans erreur, `npm audit` sans faille élevée ; Dependabot actif.

## Méthode
- Un module à la fois, en suivant son prompt. Ne rien développer hors de son périmètre.
- Expliquer chaque fichier, puis donner les commandes de vérification.
- Lister à la fin les captures à prendre pour le mémoire.
- Ne jamais inventer de données réelles : universités, quartiers et chiffres viennent de l'auteur.
