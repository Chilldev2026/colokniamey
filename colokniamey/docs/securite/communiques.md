# Communiqués (A4) — sécurité et fonctionnement

## Règles appliquées
- RGA13 : un communiqué a un niveau (information, avertissement, critique), une cible (tous, étudiants, propriétaires) et une période d'affichage. La fin doit être après le début (contrainte en base).
- RGA14 : un communiqué critique ne peut pas être masqué. `masquer_communique()` le refuse, et le bouton n'apparaît pas.
- RGA28 : un communiqué critique n'est créé, modifié ou supprimé que par un super-admin. C'est la politique RLS qui le garantit ; le formulaire ne propose simplement pas l'option aux admins.
- RG45 : titre et message passent par le contrôle de texte (S).
- RGA06 : chaque création, modification ou suppression est journalisée, sans le texte du communiqué.

## Qui voit quoi
| Fonction | Rôles autorisés |
|---|---|
| `communiques_actifs()` | visiteurs et connectés (le visiteur ne voit que la cible « tous ») |
| `masquer_communique(id)` | connectés |
| table `communiques` (lecture et écriture) | admin et super-admin (aal2) |
| table `communiques_masques` | aucune lecture directe |

## Affichage
Le module `communiques` se branche sur la zone `zone-communique` du layout par le point d'extension. Sans lui, la zone reste vide. Un visiteur qui masque un communiqué le fait seulement dans son navigateur (stockage local, facultatif).

## Tests
`supabase/tests/1050_communiques.test.sql` (droits, cible, période, masquage, journal) et `src/modules/communiques/__tests__/communiques.spec.ts`.
