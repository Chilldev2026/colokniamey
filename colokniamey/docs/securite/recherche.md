# Recherche, carte et favoris (module M5)

## Ce que voit le public (RG23, RG24)

- La recherche et la carte sont ouvertes aux visiteurs. Elles lisent seulement la vue `annonces_publiques` de M4 : annonces **publiées**, non mises en revue, dont l'auteur a un compte actif.
- Elles n'ont **aucun accès à la colonne `position`** (point exact). Elles renvoient la position publique : une zone de 150 m (précision « approximative », grille stable : même résultat à chaque appel) ou le point choisi par l'auteur (précision « exacte », rayon 0).
- Les fonctions s'exécutent avec les droits de l'appelant : c'est la RLS de M4 qui décide de ce qui est visible.

## Fonctions SQL (`0990_recherche.sql`, `0991_correctif_recherche.sql`)

| Fonction | Rôle |
|---|---|
| `rechercher_annonces(filtres, tri, curseur, limite)` | anon, authenticated |
| `annonces_carte(emprise, filtres, limite)` | anon, authenticated |
| `filtrer_annonces(filtres)` | anon, authenticated (interne au module, ne renvoie que des données publiques) |
| `mes_favoris()` | authenticated |
| `est_etudiant()` | anon, authenticated (booléen sur la personne connectée) |
| `limiter_favoris`, `exporter_donnees_recherche` | internes, aucun GRANT |

**Filtres** (jsonb) : `ville_id`, `quartier_id`, `universite_id` (université proche), `universite_ref_id` (distance), `type`, `loyer_min`, `loyer_max`, `disponible_avant`, `texte` (plein texte français), `equipements` (tous requis), `duree_mois`, `compatible`.
**Tri** : `recent`, `loyer_asc`, `loyer_desc`. **Pagination par curseur** `{ v, id }` : stable même si des annonces arrivent pendant la lecture. Page de 20, maximum 50.

## Distance à l'université (RG25, RG25 bis)

Calculée sur la position **publique**, arrondie à 10 m, et seulement si l'université de référence a une position. Dans les filtres, une université sans position est grisée avec « position pas encore renseignée ». Aucune coordonnée n'est inventée.

## Favoris

Table `favoris` : un favori par personne et par annonce, **200 au maximum**, 100 ajouts par jour (`verifier_quota`). RLS : chacun ne lit, n'ajoute et ne supprime que les siens ; on ne met en favori qu'une annonce que la RLS de M4 laisse voir. Un favori dont l'annonce n'est plus publique est masqué (pas supprimé). Les favoris sont dans l'export « Mes données ».

## Interface

- Accueil : barre de recherche. `/recherche` : liste et carte avec les **mêmes filtres, gardés dans l'URL** (un lien partagé rouvre la même recherche). `/favoris` : mes favoris.
- Carte : annonces rechargées selon la zone visible (400 ms après le dernier mouvement), marqueurs regroupés quand ils sont nombreux, cercle orange pour une zone approximative, marqueur vert « U » pour une université qui a une position. Un clic ouvre l'aperçu (photo, type, loyer, quartier, distance), puis la galerie plein écran et le détail.
- Aucune mise en cache des tuiles par le service worker.

## Limites connues

- **Filtre « compatible avec mon profil »** : le profil (M3) ne contient ni genre ni âge ; seul le critère « étudiants uniquement » est appliqué [INFORMATION MANQUANTE : genre et âge].
- **Colocations en formation** : le badge, le marqueur distinct et le filtre arrivent avec M8, qui remplacera `filtrer_annonces` et `annonces_carte` (la colonne `groupe_en_formation` existe déjà, toujours fausse).
- Le regroupement des marqueurs est calculé par cases de 60 pixels (pas de bibliothèque supplémentaire).
- Un index plein texte français a été ajouté sur la table `annonces` de M4 (un index ne modifie pas sa structure).
