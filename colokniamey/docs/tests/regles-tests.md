# Tableau règle → test → résultat

Pièce pour le mémoire (F1). **Résultat obtenu** : dernière exécution complète le 10 octobre 2026 — `npm run test:sql` (17 scripts SQL sur le projet Supabase lié), `npx vitest run` (tests de l'interface et du parcours complet), `npm run test:attaques` (82 tests d'attaque avec la seule clé publique). Tous les tests listés ont réussi. « SQL » = script de `supabase/tests`, « Vitest » = fichier de `src`.

## Utilisateurs et contenus

| Règle | Test | Résultat attendu | Résultat obtenu |
|---|---|---|---|
| RG01, RG02, RG03 | SQL `0300_auth` | e-mail unique, un seul rôle, rôle admin refusé à l'inscription | réussi |
| RG04 | Vitest `auth/validation` | mot de passe de 8 caractères au moins, liste de mots de passe courants refusés | réussi |
| RG05, RG06, RG07 | SQL `0300_auth`, `0200_referentiel` | un profil par rôle, étudiant rattaché à une université, université dans une ville | réussi |
| RG08 | SQL `0300_auth`, `0980_admin_moderation`, `1000_messagerie` ; Vitest `parcours` | un compte suspendu ne se connecte plus, ses annonces disparaissent, il ne reçoit plus de message | réussi |
| RG09, RGA02 | SQL `0910_admin_utilisateurs`, `1020_signalements` | seul un admin suspend ; jamais un compte de niveau égal ou supérieur | réussi |
| RG10 | SQL `0400_profils`, `0300_auth` | chacun ne modifie que son profil | réussi |
| RG11 | SQL `0300_auth` | téléphone obligatoire et valide | réussi |
| RG12 | Vitest `auth/inactivite` ; essai manuel | déconnexion après inactivité (7 et 14 jours) ; la déconnexion termine la session, « partout » ferme les autres appareils | inactivité réussie ; essai manuel à faire (captures) |
| RG13 | SQL `0970_annonces` ; Vitest `parcours` | un étudiant ne publie pas un studio ; un propriétaire ne publie pas une place en colocation | réussi |
| RG14 | SQL `0970_annonces` | une annonce a un seul auteur ; un tiers ne la modifie pas | réussi |
| RG15, RG16 | SQL `0970_annonces` | quartier obligatoire ; loyer nul refusé | réussi |
| RG17 | SQL `0970_annonces`, `0980_admin_moderation` | soumission en attente ; modification d'une annonce publiée la renvoie en attente ; invisible du public | réussi |
| RG18 | SQL `0970_annonces` ; Vitest `parcours` | la sixième photo est refusée (photos_max = 5) | réussi |
| RG19, RG32 | SQL `0970_annonces`, `1000_messagerie` ; Vitest `parcours` | contact seulement avec une annonce publiée ; numéro donné aux connectés et seulement si autorisé ; 30 consultations par jour | réussi |
| RG20 | SQL `1020_signalements` ; Vitest `signalements`, `parcours` | tout connecté signale ; doublon refusé ; 10 par jour | réussi |

## Carte, annonces, recherche

| Règle | Test | Résultat attendu | Résultat obtenu |
|---|---|---|---|
| RG21 | SQL `0970_annonces` ; Vitest `annonces`, `parcours` | soumission sans position refusée | réussi |
| RG22 | SQL `0970_annonces`, `0200_referentiel` ; Vitest `parcours` | position hors de la zone de la ville refusée | réussi |
| RG23 | SQL `0970_annonces`, `0990_recherche`, `audit_securite` ; attaques (position) | la position exacte n'est lisible par personne ; le public ne reçoit qu'une zone de 150 m, stable | réussi |
| RG24 | SQL `0990_recherche` ; Vitest `parcours` | seules les annonces publiées remontent, en liste comme sur la carte | réussi |
| RG25, RG25 bis | SQL `0990_recherche`, `0950_plateforme` | distance seulement si l'université a une position, arrondie à 10 m ; jamais de coordonnée inventée | réussi |
| RG28 à RG33 | SQL `0970_annonces` ; Vitest `annonces` | loyer total ≥ part, 10 règles et 15 tâches au plus, âges 16 à 99, durées cohérentes, équipements actifs seulement | réussi |
| Favoris | SQL `0990_recherche` | un utilisateur ne voit pas les favoris des autres | réussi |

## Groupes (M8)

| Règle | Test | Résultat attendu | Résultat obtenu |
|---|---|---|---|
| RG34 | SQL `1010_groupes` | un propriétaire ne lance pas de groupe ; places recherchées ≤ places − 1 | réussi |
| RG35, RG37 | SQL `1010_groupes` ; Vitest `groupes` | les groupes existants sont montrés avec places restantes et part estimée | réussi |
| RG36 | SQL `1010_groupes` | un seul groupe actif par logement ; limite globale ; seul l'initiateur accepte | réussi |
| RG38 | SQL `1010_groupes` ; Vitest `parcours` | le groupe passe complet, refuse les nouvelles demandes, notifie | réussi |
| RG39 | SQL `1010_groupes` | transmission au plus ancien membre ; clôture automatique après 30 jours ou logement dépublié | réussi |

## Sécurité du contenu et identité

| Règle | Test | Résultat attendu | Résultat obtenu |
|---|---|---|---|
| RG45, RG46 | SQL `0350_securite_contenu`, `0980_admin_moderation` ; Vitest `parcours` | trois issues ; message privé bloqué sans revue ; terme proposé par un admin non détecté avant validation du super-admin | réussi |
| RG47 | SQL `0350_securite_contenu`, `0980_admin_moderation` | blocages journalisés ; alerte et liste des récidives au-delà de 3 en 30 jours | réussi |
| RG48 à RG50 | Vitest `securite/photos` ; SQL `0350_securite_contenu` | signature, WebP sans EXIF, dHash, photo publique seulement après validation, photo déjà refusée bloquée | réussi |
| RG51 à RG58 | SQL `0960_kyc` ; Vitest `identite` | dépôt sans avatar refusé ; 3 dossiers par 30 jours ; images illisibles de l'utilisateur ; changement de prénom suspend le statut ; effacement après 30 jours ; image chiffrée illisible sans clé | réussi |
| RG59 | SQL `0960_kyc`, `1010_groupes`, `0970_annonces` | KYC désactivé : tout étudiant actif passe, aucune image collectée ; seul le super-admin l'active | réussi |
| RG26, RG27 | Essai manuel sur Android et iPhone (voir `docs/deploiement.md`) | bouton d'installation, guide iPhone, mise à jour proposée en un clic, page hors ligne | à faire sur l'adresse de production |

## Administration

| Règle | Test | Résultat attendu | Résultat obtenu |
|---|---|---|---|
| RGA01, RGA26, RGA27 | Vitest `admin/acces` | menu et routes selon le rôle ; une route interdite renvoie à l'accueil du rôle | réussi |
| RGA03 | SQL `0910_admin_utilisateurs` | le dernier super-admin ne peut être ni rétrogradé ni suspendu | réussi |
| RGA04 | SQL de chaque module admin | tout appel d'admin sans niveau aal2 est refusé | réussi |
| RGA05, RGA08, RGA09, RGA38 | SQL `0910_admin_utilisateurs` | rôle admin donné par un super-admin ; suspension avec motif ; désactivation avec anonymisation ; MFA réinitialisé avec motif | réussi |
| RGA06, RGA07 | SQL `0100_core`, tous les modules admin | actions journalisées ; journal en ajout seul | réussi |
| RGA10 | SQL `1000_messagerie`, `1020_signalements` | un admin ne lit ni message ni conversation, sauf le message joint à un signalement | réussi |
| RGA11 | SQL `0980_admin_moderation` ; Vitest `moderation` | refuser ou retirer sans motif est impossible ; motif notifié à l'auteur | réussi |
| RGA12 | SQL `1020_signalements` ; Vitest `parcours` | deux admins ne prennent pas le même signalement ; seul celui qui l'a pris le clôt | réussi |
| RGA15, RGA16, RGA17 | SQL `0950_plateforme`, `1000_messagerie`, `0970_annonces` | maintenance par le super-admin ; écritures refusées pendant la maintenance ; paramètres journalisés | réussi |
| RGA28 | SQL `0980_admin_moderation` | un terme proposé par un admin reste inactif ; un admin ne peut pas le valider | réussi |
| RGA29 à RGA35 | SQL `0910_admin_utilisateurs`, `0980`, `0960`, `1020` | files inscrites, alertes, relances, aucune donnée personnelle dans les notifications | réussi |
| RGA36 | SQL `0910_admin_utilisateurs` | session admin vérifiée par la base, 30 minutes d'inactivité | réussi |
| RGA13 | SQL `1050_communiques` ; Vitest `communiques` | niveau, cible et période ; fin avant début refusée ; expiré et futur non affichés | réussi |
| RGA14 | SQL `1050_communiques` ; Vitest `communiques` | un communiqué critique ne se masque pas (ni bouton, ni appel accepté) | réussi |
| RGA28 (communiqués) | SQL `1050_communiques` | un admin ne crée, ne modifie ni ne supprime un communiqué critique | réussi |
| RGA18, RGA19, RGA20 | SQL `1040_admin_stats_observabilite` ; Vitest `observabilite` | visites sans donnée personnelle ; erreurs groupées par empreinte, sans donnée sensible, avec statut | réussi |
| RGA21 à RGA25 | SQL `1040_admin_stats_observabilite` | quatre indicateurs, mesures anonymes par lots, réservés au super-admin | réussi |

## Protection des données et durcissement

| Règle | Test | Résultat attendu | Résultat obtenu |
|---|---|---|---|
| RGP03, RG55 | Vitest `identite` (chiffrement) ; SQL `0960_kyc` | AES-256-GCM, fichier illisible sans la bonne clé, bucket sans politique d'utilisateur | réussi |
| RGP04 | SQL `audit_securite` ; attaques (lecture de chaque table) | toute table du schéma public a une RLS ; un visiteur ne lit que les tables publiques et n'écrit nulle part | réussi |
| RGP07, RGP02 | Contrôle de l'adresse de production (à faire après déploiement) | en-têtes CSP, HSTS, Permissions-Policy présents | à vérifier en production |
| RGP10 | SQL `0960_kyc`, `0980`, `1000` | aucune donnée personnelle ni terme sensible dans les journaux et notifications | réussi |
| RGP11 | SQL de chaque module | `exporter_mes_donnees()` contient les données du module, sans chemin de fichier privé | réussi |
| RGP13, RGP25 | Vitest `scripts/sauvegarde` | sauvegarde chiffrée, illisible sans la phrase, modification détectée | réussi (chiffrement) ; restauration à tester sur un projet vide |
| RGP16 | `npm audit`, recherche de secrets, OWASP ZAP | aucune faille élevée ; aucune clé dans le dépôt | audit réussi ; gitleaks et ZAP : voir `.github/workflows` |
| RGP17 | SQL `audit_securite` ; attaques (appels de fonctions) | seules les fonctions listées sont exécutables par visiteur ou connecté ; 36 appels de fonctions internes ou réservées refusés | réussi |
| RGP18 | SQL `audit_securite` | toute vue en `security_invoker` | réussi |
| RGP19 | attaques (inscription et connexion sans jeton) | refus « captcha » | réussi |
| RGP20 | SQL `1000_messagerie`, `0970_annonces`, `1020_signalements` | 21ᵉ message en une minute, 31ᵉ contact, 11ᵉ signalement, 21ᵉ conversation refusés | réussi |
| RGP21 | SQL `audit_securite` ; attaques (buckets) | limite de taille et types sur chaque bucket ; buckets privés illisibles ; aucune écriture directe dans `photos_publiques` ni `kyc_prives` | réussi |
| RGP22 | attaques (Edge Functions) | sans jeton, avec la clé publique seule, depuis une origine non autorisée, en GET : toujours refusé | réussi |
| RGP23 | SQL `1000_messagerie` | `messages` seul dans la publication Realtime, filtré par la RLS ; aucun canal public | réussi (la réception par un tiers se vérifie à la main avec deux navigateurs) |
| RGP27 | `supabase db lint`, `npm audit`, Dependabot | aucune erreur de lint, aucune faille élevée, mises à jour hebdomadaires | réussi |
