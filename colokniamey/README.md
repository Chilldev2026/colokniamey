# ColokNiamey

Application web progressive (PWA) qui met en relation les étudiants pour la colocation à Niamey (Niger). Projet de fin de cycle (Licence professionnelle en génie logiciel, IAT).

**Pile** : Vue 3 + TypeScript, Vite, Pinia, Vue Router, Leaflet ; **Supabase seulement** (Auth avec double authentification des admins, PostgreSQL avec RLS, Storage, Realtime, Edge Functions). Aucun serveur applicatif, coût 0 $.

## Démarrer

```sh
npm install
copy .env.example .env      # puis renseigne les trois variables VITE_* (voir docs/securite/configuration-auth.md)
npm run dev
```

## Vérifier

| Commande | Ce qu'elle fait |
|---|---|
| `npm run type-check` | types TypeScript (strict, aucun `any`) |
| `npm run lint` | oxlint + eslint |
| `npx vitest run` | tests de l'interface et parcours complet avec un client Supabase simulé |
| `npm run test:sql` | rejoue tous les scripts SQL de `supabase/tests` (RLS de chaque module, quotas, audit de sécurité) sur le projet lié ; chaque script est annulé à la fin |
| `npm run test:attaques` | tente des attaques avec la seule clé publique (voir l'en-tête de `scripts/attaques.mjs`) |
| `npm run build` | construit le site dans `dist` |
| `npm run sauvegarde` | sauvegarde chiffrée (voir `docs/securite/sauvegarde.md`) |

## Organisation

Chaque module est indépendant : `src/modules/<module>/` (`index.ts` = contrat public, `services/` = seul endroit qui appelle Supabase) et ses migrations dans `supabase/migrations/`. La liste des modules actifs est dans `src/app/modules.ts`. Les modules optionnels se branchent sur les pages des autres par des points d'extension (`src/core/extensions.ts`).

Les règles de gestion, la sécurité et la charte graphique sont décrites dans `CLAUDE.md`. Documentation par module : `docs/securite/`. Tests et preuves pour le mémoire : `docs/tests/`. Mise en ligne : `docs/deploiement.md`. Incident de sécurité : `docs/securite/incident.md`.
