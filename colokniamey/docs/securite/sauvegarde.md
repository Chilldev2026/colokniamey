# Sauvegarde et restauration (RGP13, RGP25)

L'offre gratuite de Supabase **n'a pas de sauvegarde automatique**. Sans ce script, une erreur de manipulation ou un incident peut faire perdre toutes les données.

## Ce qui est sauvegardé

| Élément | Sauvegardé ? | Pourquoi |
|---|---|---|
| Base de données (schéma et données) | oui, chiffrée | `supabase db dump` |
| Bucket `photos_publiques` | oui, chiffrée | `supabase db dump` n'inclut pas le Storage (RGP25) |
| Bucket `photos_en_attente` | non | photos temporaires, redemandées si perdues |
| Bucket `kyc_prives` | **jamais** | pièces d'identité : les perdre est préférable à les copier ailleurs (RGP25) ; images effacées de toute façon 30 jours après la décision |
| Secrets (`KYC_CLE`, clés…) | non | à garder dans un gestionnaire de mots de passe |

## Faire une sauvegarde

Prérequis : **Docker Desktop** (ou Podman) installé, car `supabase db dump` en a besoin, et projet lié (`npx supabase link`).

```
set SAUVEGARDE_PHRASE=<une phrase secrète d'au moins 16 caractères, connue de toi seul>
set SAUVEGARDE_DOSSIER=D:\sauvegardes-colokniamey
npm run sauvegarde
```

Le script crée `base-AAAA-MM-JJ.sql.chiffre` et `photos-AAAA-MM-JJ.tar.chiffre` : **AES-256-GCM**, clé dérivée de la phrase par scrypt. Il refuse un dossier **dans** le dépôt Git, supprime ses fichiers temporaires et garde les 8 dernières sauvegardes. **Copie ensuite le dossier hors de cet ordinateur** (disque externe, autre cloud) : une sauvegarde sur le même disque ne protège pas d'une panne.

**Chaque semaine** : planificateur de tâches Windows → tâche hebdomadaire qui exécute `npm run sauvegarde` dans le dossier du projet, avec la variable `SAUVEGARDE_PHRASE` définie pour la tâche. La phrase secrète ne doit figurer ni dans le dépôt, ni dans Supabase.

## Tester la restauration (une fois, puis chaque trimestre)

Une sauvegarde jamais restaurée n'est pas une sauvegarde. Sur un **projet Supabase vide** créé pour l'occasion (jamais sur la production) :

1. Applique les migrations au projet vide : `npx supabase link --project-ref <vide>` puis `npx supabase db push`.
2. Récupère l'adresse de connexion du projet vide (*Project Settings → Database → Connection string*).
3. Restaure : `node scripts/restaurer.mjs base-AAAA-MM-JJ.sql.chiffre --appliquer "<adresse>"` (demande `psql` : outils PostgreSQL). Le fichier déchiffré est supprimé aussitôt.
4. Vérifie : nombre de profils et d'annonces, connexion d'un compte test, puis `npm run test:sql` sur ce projet.
5. Note la date et le résultat dans le fichier d'incident ou le journal du mémoire.

Le chiffrement est testé automatiquement (`scripts/__tests__/sauvegarde.spec.mjs` : aller-retour, mauvaise phrase refusée, fichier modifié détecté, aucun texte lisible dans le fichier chiffré).

## Limites connues

- Je n'ai pas pu lancer `supabase db dump` sur la machine de développement (Docker absent) : le script est écrit et son chiffrement testé, mais **la sauvegarde complète et la restauration restent à essayer par toi** (étapes ci-dessus).
- La phrase secrète perdue = sauvegardes inutilisables. Garde-la dans un gestionnaire de mots de passe, avec une copie hors ligne.
