# Sécurité du contenu (module S) : mode d'emploi

## 1. Textes (RG45 à RG47)

**Règle** : tout texte enregistré par un module passe par un déclencheur `BEFORE INSERT OR UPDATE`.

```sql
-- La table a une colonne  en_revue boolean not null default false  (sauf messages privés)
create trigger annonces_controle_texte
  before insert or update on public.annonces
  for each row execute function public.controler_colonnes_texte(
    'annonce',   -- type de contenu (file de modération)
    'public',    -- 'public' ou 'prive' (messages privés : blocage seulement, RGA10)
    'auteur_id', -- colonne qui contient l'auteur
    'titre', 'description'  -- colonnes de texte à contrôler
  );
```

Trois issues : **accepte**, **revue** (ligne enregistrée mais `en_revue = true`, ligne ajoutée dans
`contenus_en_revue` ; la lecture publique de la table doit exclure `en_revue`), **bloque** (exception en français
qui n'affiche jamais le terme).

**Dans l'interface** : le service du module appelle `controlerTexte()` (exporté par `@/modules/securite`)
avant d'enregistrer, et affiche `messageErreurContenu(erreur)` si la base refuse.

### Limite à connaître : journalisation des blocages (RG47)

Le déclencheur ne peut pas journaliser lui-même un blocage : son exception annule toute la transaction,
journal compris. La journalisation est donc faite par `controler_texte()`, que l'interface appelle avant
l'enregistrement. Conséquence : un utilisateur qui contourne l'interface (appel direct à l'API) est **bloqué**
(le déclencheur protège toujours) mais son essai n'est **pas compté** dans les 3 blocages avant alerte.
Si cette lacune est gênante, la solution est de faire passer les écritures par une fonction RPC du module
(qui peut attraper l'exception, journaliser, puis la relancer).

### Normalisation et limites de la détection (RG46)

Avant comparaison, le texte est mis en minuscules, sans accents ; les chiffres et symboles qui imitent des
lettres sont remplacés (`0→o, 3→e, 4→a, 5→s, 7→t, 8→b, 9→g, @→a, $→s, !→i, |→l`, `1` essayé comme `i` puis
comme `l`) ; la ponctuation et les espaces insérés dans un mot sont retirés (`s.a.l.o.p.e`) ; les lettres répétées
sont réduites (`saaalope`). Un terme est reconnu comme mot entier (pluriel `s`/`x` accepté) ; les termes de
7 lettres et plus sont aussi cherchés sans espaces.

Ne sont **pas** détectés : conjugaisons non listées, fautes d'orthographe volontaires (`pronno`), mots coupés
par des lettres ajoutées, langues locales (termes à fournir par l'auteur), textes en image. Une liste de
mots n'est qu'un filet : la modération humaine (A3) et les signalements (M7) restent nécessaires.

La liste initiale est courte (`0350_securite_contenu.sql`) et se complète dans A3 : un admin propose un terme,
il reste inactif (`valide = false`) jusqu'à validation par un super-admin (RGA28). **Aucune liste de termes
n'est jamais renvoyée au navigateur** (`verifier_texte` n'a aucun GRANT).

Les colonnes `nom`, `prenom`, `filiere`, `bio` et `adresse` de M2 n'ont pas encore de déclencheur : M3 (profils)
les contrôlera avec le modèle ci-dessus.

## 2. Photos (RG48 à RG50)

**Règle** : toute photo passe par `<EnvoiPhoto usage="avatar|annonce" />`. Aucun envoi direct vers Storage.

Chaîne de traitement dans le navigateur :
taille maximale (`photo_taille_max_mo`) → type réel par la **signature du fichier** (JPEG, PNG, WebP) →
dimension minimale (`photo_dimension_min`) → analyse **nsfwjs** (refus si probabilité ≥ `nsfw_seuil`, 0,7 [À VALIDER]) →
empreinte **dHash** → **ré-encodage WebP dans un canvas** (supprime EXIF et position GPS) →
`precontroler_photo()` (image déjà refusée ?) → dépôt dans `photos_en_attente/<user_id>/…` → `enregistrer_photo()`.

Côté serveur : buckets avec `file_size_limit` (3 Mio) et `allowed_mime_types`, écriture limitée au dossier de
l'auteur, quota de 30 envois par jour compté **dans la politique Storage** (donc aussi pour un envoi direct par
l'API), aucune écriture utilisateur dans `photos_publiques`. L'Edge Function `securite-photos-decision`
(admin aal2) valide ou refuse, copie la photo vers `photos_publiques` ou supprime le fichier, journalise et
notifie l'auteur.

**Mode privé** : `<EnvoiPhoto mode="traiter" />` ne publie rien et rend le fichier préparé (utilisé par K).

### Limites à connaître

- L'analyse nsfwjs tourne dans le navigateur : elle se contourne (envoi direct par l'API, navigateur modifié).
  Seule la **validation humaine** garantit qu'aucune photo inappropriée n'est publiée (RG49). Si le modèle ne
  se charge pas, l'envoi continue (la photo reste en attente).
- Le modèle (MobileNetV2, ~3,5 Mo) est inclus dans le code de l'application et chargé au premier envoi :
  il est servi par notre propre site, jamais par un tiers (RGP12 bis). Il peut produire des faux positifs et
  des faux négatifs ; le seuil est à régler avec de vraies photos.
- La détection d'images déjà refusées compare les empreintes avec une tolérance de 4 bits sur 64. Une
  retouche importante change l'empreinte.
- Un fichier déposé dans Storage mais jamais enregistré (envoi interrompu) reste dans `photos_en_attente`.
  Un nettoyage périodique est à prévoir en F1.
- `npm audit` signale 4 failles **modérées** dans la chaîne `@tensorflow/tfjs → argparse → sprintf-js`
  (déni de service par formats de chaîne). Elles ne concernent pas des données saisies par les utilisateurs.
  Aucune faille élevée.

## 3. Modération automatique externe (option, désactivée) 

Le prompt demande de comparer les services avant de proposer d'en activer un. **Rien n'est activé** et aucune
Edge Function n'appelle un service externe : l'envoi d'un texte privé ou d'une photo à un tiers est un
traitement de données personnelles à déclarer dans la politique de confidentialité (RGP12 bis : aucun tiers
sauf OpenStreetMap et Turnstile). Éléments à vérifier **sur les sites officiels** avant toute décision
(les offres changent, je ne les ai pas vérifiées pour cette rédaction) :

| Service | Type | À vérifier |
|---|---|---|
| API de modération d'OpenAI (`omni-moderation`) | texte et images | gratuité réelle, durée de conservation, transfert hors UE/Afrique |
| Google Cloud Vision SafeSearch / Natural Language | images / texte | facturation (carte bancaire exigée, ce qui contredit « 0 $ »), région |
| Azure AI Content Safety | texte et images | niveau gratuit, carte bancaire, région |
| Perspective API (Google/Jigsaw) | texte (toxicité) | service annoncé comme arrêté en 2026 [À VÉRIFIER] |
| Modèle auto-hébergé (par exemple détecteur de toxicité dans une Edge Function) | texte | poids du modèle, limites de durée des Edge Functions gratuites |

Recommandation : ne pas l'activer pour la soutenance. La liste de termes + nsfwjs + validation humaine couvrent
l'exigence, sans transfert de données vers un tiers. À présenter dans le mémoire comme axe d'amélioration.
