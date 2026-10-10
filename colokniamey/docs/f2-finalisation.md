# F2 — Finalisation : ce qui est fait et ce qui reste

## Fait et vérifié automatiquement (10 octobre 2026)
- 17 scripts SQL réussis (`npm run test:sql`), 332 tests Vitest réussis, 82 tests d'attaque avec la seule clé publique.
- `supabase db lint --schema public` : aucune erreur (les avertissements du schéma `extensions` viennent de PostGIS, pas de notre code).
- `npm audit --omit=dev` : aucune faille élevée (4 failles modérées, dépendance `sprintf-js`, sans correctif non cassant).
- Aucune clé secrète (`service_role`, `KYC_CLE`, `RESEND_API_KEY`) dans le code compilé `dist/`.
- Tableau règle → test → résultat : `docs/tests/regles-tests.md` (phase 2 incluse).
- Construction de production et service worker générés sans erreur.

## À faire par toi (je ne peux pas le faire depuis cet ordinateur)
1. **Déployer** sur Cloudflare Pages (voir `docs/deploiement.md`), puis refaire les en-têtes de sécurité sur l'adresse réelle.
2. **Lighthouse** : dans Chrome, F12 → Lighthouse, sur l'adresse de production (performance, accessibilité, PWA). Garde les captures.
3. **Installation réelle** sur un Android (Chrome) et un iPhone (Safari). Vérifie aussi que le bandeau de communiqué et la page Maintenance s'affichent après une mise à jour du site.
4. **Icônes définitives** : remplace les fichiers de `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`, `apple-touch-icon.png`, `favicon.ico`) quand ton logo est validé. Garde les mêmes noms.
5. **APK Android (facultatif)** : outil gratuit d'emballage de PWA (PWABuilder), à lancer sur l'adresse de production une fois le site déployé.
6. **gitleaks** et **OWASP ZAP** : les deux workflows sont dans `.github/workflows` ; lance-les depuis l'onglet Actions de GitHub.
7. **Captures d'écran** pour le mémoire : `docs/tests/regles-tests.md` indique les essais manuels.
