// A2 : routes réservées, menus et accueils par rôle (RGA26), double authentification (RGA04).
import { beforeEach, describe, expect, it } from 'vitest'
import type { RouteMeta } from 'vue-router'
import { declarerAccueilRole } from '@/core/acces'
import { decider } from '@/app/gardes'
import { accueilAdmin, construireMenu } from '../menu'
import { routesEnfantsAdmin, routesAdmin } from '../routes'
import { actionsPossibles, rang } from '../utilisateurs/types'

beforeEach(() => {
  // Même branchement que dans index.ts du module
  declarerAccueilRole((role) => (role === 'admin' || role === 'super_admin' ? accueilAdmin(routesEnfantsAdmin, role) : '/'))
})

const parent = routesAdmin.find((r) => r.path === '/admin')!
const metaAdmin = (enfant: string): RouteMeta => {
  const route = routesEnfantsAdmin.find((r) => r.path === enfant)!
  // La route enfant hérite des champs du parent (connexion, aal2), les siens l'emportent
  return { ...parent.meta, ...route.meta }
}

describe('menu de la coque (RGA26)', () => {
  it('ne montre à l\'admin que les routes qu\'il peut ouvrir', () => {
    const libelles = construireMenu(routesEnfantsAdmin, 'admin').map((e) => e.libelle)
    expect(libelles).toContain('Utilisateurs')
    expect(libelles).not.toContain('Administrateurs')
  })

  it('montre au super-admin la page Administrateurs, Pilotage avant Opérations', () => {
    const menu = construireMenu(routesEnfantsAdmin, 'super_admin')
    expect(menu.map((e) => e.libelle)).toEqual(['Administrateurs', 'Utilisateurs'])
    expect(menu.map((e) => e.section)).toEqual(['pilotage', 'operations'])
  })

  it('ne construit aucun menu pour un étudiant, un propriétaire ou un visiteur', () => {
    expect(construireMenu(routesEnfantsAdmin, 'etudiant')).toEqual([])
    expect(construireMenu(routesEnfantsAdmin, 'proprietaire')).toEqual([])
    expect(construireMenu(routesEnfantsAdmin, null)).toEqual([])
  })

  it('a pour accueil la première page autorisée du menu de chaque rôle', () => {
    expect(accueilAdmin(routesEnfantsAdmin, 'admin')).toBe('/admin/utilisateurs')
    expect(accueilAdmin(routesEnfantsAdmin, 'super_admin')).toBe('/admin/administrateurs')
  })
})

describe('gardes de route (RGA04, RGA26)', () => {
  it('renvoie un admin qui ouvre une route du super-admin vers sa file de travail, avec un message', () => {
    const decision = decider(metaAdmin('administrateurs'), '/admin/administrateurs', { role: 'admin', aal2: true })
    expect(decision).toMatchObject({ path: '/admin/utilisateurs' })
    expect(decision).toHaveProperty('message')
  })

  it('laisse le super-admin ouvrir la page Administrateurs', () => {
    expect(decider(metaAdmin('administrateurs'), '/admin/administrateurs', { role: 'super_admin', aal2: true })).toBe(true)
  })

  it('renvoie un étudiant ou un propriétaire vers l\'accueil public', () => {
    expect(decider(metaAdmin('utilisateurs'), '/admin/utilisateurs', { role: 'etudiant', aal2: false })).toEqual({ path: '/' })
    expect(decider(metaAdmin('utilisateurs'), '/admin/utilisateurs', { role: 'proprietaire', aal2: true })).toEqual({ path: '/' })
  })

  it('renvoie un visiteur vers la connexion, en gardant la page voulue', () => {
    expect(decider(metaAdmin('utilisateurs'), '/admin/utilisateurs', { role: null, aal2: false })).toEqual({
      path: '/connexion',
      query: { redirect: '/admin/utilisateurs' },
    })
  })

  it('renvoie un admin sans double authentification vers /admin/mfa', () => {
    expect(decider(metaAdmin('utilisateurs'), '/admin/utilisateurs', { role: 'admin', aal2: false })).toEqual({
      path: '/admin/mfa',
      query: { redirect: '/admin/utilisateurs' },
    })
  })

  it('laisse un admin en aal2 ouvrir ses pages', () => {
    expect(decider(metaAdmin('utilisateurs'), '/admin/utilisateurs', { role: 'admin', aal2: true })).toBe(true)
  })

  it('l\'écran MFA est ouvert aux admins sans aal2, mais pas aux autres rôles', () => {
    const mfa = routesAdmin.find((r) => r.path === '/admin/mfa')!.meta!
    expect(decider(mfa, '/admin/mfa', { role: 'admin', aal2: false })).toBe(true)
    expect(decider(mfa, '/admin/mfa', { role: 'etudiant', aal2: false })).toEqual({ path: '/' })
  })

  it('renvoie une personne connectée qui ouvre une page de visiteur vers son espace', () => {
    expect(decider({ visiteurSeulement: true }, '/inscription', { role: 'admin', aal2: false })).toMatchObject({ path: '/admin/utilisateurs' })
    expect(decider({ visiteurSeulement: true }, '/inscription', { role: 'etudiant', aal2: false })).toEqual({ path: '/compte' })
  })
})

describe('actions affichées selon le niveau (RGA02, RGA27)', () => {
  const moi = (role: 'admin' | 'super_admin') => ({ id: 'moi', role })
  const cible = (role: 'etudiant' | 'proprietaire' | 'admin' | 'super_admin', statut: 'actif' | 'suspendu' | 'desactive' = 'actif') => ({ id: 'cible', role, statut })

  it('classe les rôles', () => {
    expect([rang('etudiant'), rang('proprietaire'), rang('admin'), rang('super_admin')]).toEqual([0, 0, 1, 2])
  })

  it('n\'offre aucune action sur soi-même', () => {
    expect(actionsPossibles(moi('super_admin'), { id: 'moi', role: 'super_admin', statut: 'actif' })).toEqual([])
  })

  it('n\'offre aucune action à un admin sur un autre admin ou un super-admin', () => {
    expect(actionsPossibles(moi('admin'), cible('admin'))).toEqual([])
    expect(actionsPossibles(moi('admin'), cible('super_admin'))).toEqual([])
  })

  it('offre à un admin la suspension et la désactivation d\'un étudiant, sans suppression définitive', () => {
    const actions = actionsPossibles(moi('admin'), cible('etudiant'))
    expect(actions).toEqual(['suspendre', 'desactiver_et_anonymiser'])
    expect(actions).not.toContain('supprimer_definitivement')
    expect(actions).not.toContain('changer_role')
    expect(actions).not.toContain('reinitialiser_mfa')
  })

  it('propose la réactivation d\'un compte suspendu', () => {
    expect(actionsPossibles(moi('admin'), cible('proprietaire', 'suspendu'))).toContain('reactiver')
  })

  it('réserve au super-admin la suppression, le changement de rôle et la réinitialisation du MFA', () => {
    const surEtudiant = actionsPossibles(moi('super_admin'), cible('etudiant'))
    expect(surEtudiant).toEqual(expect.arrayContaining(['supprimer_definitivement', 'changer_role']))
    const surAdmin = actionsPossibles(moi('super_admin'), cible('admin'))
    expect(surAdmin).toEqual(expect.arrayContaining(['changer_role', 'reinitialiser_mfa', 'supprimer_definitivement']))
  })

  it('autorise seulement la réinitialisation du MFA sur un autre super-admin (exception à RGA02)', () => {
    expect(actionsPossibles(moi('super_admin'), cible('super_admin'))).toEqual(['reinitialiser_mfa'])
  })

  it('n\'offre rien sur un compte désactivé', () => {
    expect(actionsPossibles(moi('super_admin'), cible('etudiant', 'desactive'))).toEqual([])
  })
})
