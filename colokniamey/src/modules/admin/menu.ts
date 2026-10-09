// Construction du menu de la coque admin à partir des routes des sous-modules actifs (RGA26).
// Fonctions pures : elles ne dépendent ni du router ni de Supabase, donc faciles à tester.

import type { RouteRecordRaw } from 'vue-router'
import type { Role } from '@/core/modules/types'
import type { EntreeMenuCalculee } from './types'

const ORDRE_SECTIONS = { pilotage: 0, operations: 1 } as const

/** Les routes enfants de /admin qui déclarent meta.menuAdmin et que ce rôle a le droit d'ouvrir. */
export function construireMenu(routes: RouteRecordRaw[], role: Role | null): EntreeMenuCalculee[] {
  if (role !== 'admin' && role !== 'super_admin') return []
  const entrees: EntreeMenuCalculee[] = []
  for (const route of routes) {
    const menu = route.meta?.menuAdmin
    if (!menu) continue
    const roles = route.meta?.roles ?? []
    if (roles.length > 0 && !roles.includes(role)) continue
    entrees.push({ ...menu, vers: `/admin/${route.path}`, roles })
  }
  return entrees.sort((a, b) => ORDRE_SECTIONS[a.section] - ORDRE_SECTIONS[b.section] || a.ordre - b.ordre)
}

/** Accueil d'un rôle : tant qu'A1 n'est pas installé, c'est la première page autorisée de son menu (RGA26). */
export function accueilAdmin(routes: RouteRecordRaw[], role: Role | null): string {
  const premiere = construireMenu(routes, role)[0]
  return premiere ? premiere.vers : '/admin/securite'
}
