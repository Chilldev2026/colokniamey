// A2 : inactivité de 30 minutes avec avertissement (RGA36), bandeau de relance (RGA32), liens (RGA31, RGA33),
// coques par rôle (RGA26) et appel de l'Edge Function admin-utilisateurs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { FunctionsHttpError } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>>(() => Promise.resolve({ data: [], error: null })),
  invoke: vi.fn<(nom: string, options: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>>(() =>
    Promise.resolve({ data: { ok: true }, error: null }),
  ),
  niveau: 'aal2' as string,
}))

vi.mock('@/core/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
    from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: mocks.niveau, nextLevel: 'aal2' }, error: null }),
        listFactors: () => Promise.resolve({ data: { all: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Téléphone', created_at: '2026-01-01' }] }, error: null }),
      },
    },
  },
}))
vi.mock('@/modules/auth', () => ({
  useAuthStore: () => ({ profil: { prenom: 'Awa', nom: 'Diallo' }, role: 'admin', session: { user: { id: 'moi' } }, deconnecter: () => Promise.resolve(), expirerSession: () => Promise.resolve() }),
}))

import { demarrerInactivite, effacerInactivite, reinitialiserInactivite } from '@/core/useInactivite'
import { definirRoleCourant } from '@/core/acces'
import { useAdminStore } from '../stores/adminStore'
import BandeauRelance from '../components/BandeauRelance.vue'
import CoqueAdmin from '../components/CoqueAdmin.vue'
import CoqueSuperAdmin from '../components/CoqueSuperAdmin.vue'
import CoqueSelecteur from '../components/CoqueSelecteur.vue'
import { lienMailto, lienWhatsApp, messageRelance, numeroWhatsApp } from '../utilisateurs/liens'
import { executerAction } from '../utilisateurs/services/utilisateursService'
import { construireMenu } from '../menu'
import { routesEnfantsAdmin } from '../routes'

const MINUTE = 60_000
const NOW = new Date('2026-10-09T10:00:00Z').getTime()

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.rpc.mockReset()
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  mocks.invoke.mockClear()
  mocks.niveau = 'aal2'
})

describe('inactivité de l\'admin : 30 minutes, avertissement à 2 minutes (RGA36)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    effacerInactivite()
  })
  afterEach(() => {
    vi.useRealTimers()
    effacerInactivite()
  })

  function demarrer() {
    const surExpiration = vi.fn<() => void>()
    const surAvertissement = vi.fn<(reste: number | null) => void>()
    const arreter = demarrerInactivite({
      delaiMs: () => 30 * MINUTE,
      intervalleMs: 10_000,
      avertirAvantMs: 2 * MINUTE,
      surAvertissement,
      surExpiration,
    })
    return { surExpiration, surAvertissement, arreter }
  }

  it('n\'avertit pas avant 28 minutes', () => {
    reinitialiserInactivite(NOW)
    const { surExpiration, surAvertissement, arreter } = demarrer()
    vi.advanceTimersByTime(27 * MINUTE)
    expect(surAvertissement).not.toHaveBeenCalledWith(expect.any(Number))
    expect(surExpiration).not.toHaveBeenCalled()
    arreter()
  })

  it('avertit à partir de 28 minutes avec le temps restant', () => {
    reinitialiserInactivite(NOW)
    const { surExpiration, surAvertissement, arreter } = demarrer()
    vi.advanceTimersByTime(29 * MINUTE)
    const avertissements = surAvertissement.mock.calls.map((c) => c[0]).filter((v): v is number => typeof v === 'number')
    const dernier = avertissements[avertissements.length - 1]!
    expect(dernier).toBeLessThanOrEqual(2 * MINUTE)
    expect(dernier).toBeGreaterThan(0)
    expect(surExpiration).not.toHaveBeenCalled()
    arreter()
  })

  it('déconnecte après 30 minutes sans activité', () => {
    reinitialiserInactivite(NOW)
    const { surExpiration, arreter } = demarrer()
    vi.advanceTimersByTime(31 * MINUTE)
    expect(surExpiration).toHaveBeenCalledTimes(1)
    arreter()
  })

  it('« Rester connecté » repousse l\'échéance', () => {
    reinitialiserInactivite(NOW)
    const { surExpiration, arreter } = demarrer()
    vi.advanceTimersByTime(29 * MINUTE)
    reinitialiserInactivite(Date.now())
    vi.advanceTimersByTime(29 * MINUTE)
    expect(surExpiration).not.toHaveBeenCalled()
    arreter()
  })
})

describe('signalement de l\'activité à la base (RGA36)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('prévient la base au plus toutes les 5 minutes', async () => {
    const admin = useAdminStore()
    await admin.signalerActivite()
    await admin.signalerActivite()
    expect(mocks.rpc.mock.calls.filter((c) => c[0] === 'signaler_activite_admin')).toHaveLength(1)
    vi.advanceTimersByTime(5 * MINUTE + 1)
    await admin.signalerActivite()
    expect(mocks.rpc.mock.calls.filter((c) => c[0] === 'signaler_activite_admin')).toHaveLength(2)
  })

  it('« Rester connecté » (forcer) prévient aussitôt la base', async () => {
    const admin = useAdminStore()
    await admin.signalerActivite()
    await admin.signalerActivite(true)
    expect(mocks.rpc.mock.calls.filter((c) => c[0] === 'signaler_activite_admin')).toHaveLength(2)
  })
})

describe('bandeau de relance (RGA32)', () => {
  it('disparaît après « Vu » et prévient la base', async () => {
    const admin = useAdminStore()
    admin.relances = [{ id: 7, creeLe: new Date().toISOString(), motif: null }]
    const w = mount(BandeauRelance)
    expect(w.text()).toContain('Relance du super-admin')
    await w.find('button').trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('marquer_relance_vue', { p_id: 7 })
    expect(w.text()).not.toContain('Relance du super-admin')
  })

  it('ne contient aucun nom, téléphone ni image (RGA33)', () => {
    const admin = useAdminStore()
    admin.relances = [{ id: 8, creeLe: new Date().toISOString(), motif: null }]
    const w = mount(BandeauRelance)
    expect(w.text()).not.toMatch(/\d{2} ?\d{2} ?\d{2} ?\d{2}/)
    expect(w.find('img').exists()).toBe(false)
  })
})

describe('liens de relance par e-mail et WhatsApp (RGA31, RGA33)', () => {
  it('met les numéros au format wa.me', () => {
    expect(numeroWhatsApp('90 12 34 56')).toBe('22790123456')
    expect(numeroWhatsApp('+227 90 12 34 56')).toBe('22790123456')
    expect(numeroWhatsApp('0022790123456')).toBe('22790123456')
    expect(numeroWhatsApp('22790123456')).toBe('22790123456')
    expect(numeroWhatsApp('123')).toBeNull()
  })

  it('construit un lien WhatsApp prérempli', () => {
    const lien = lienWhatsApp('90123456', 'Bonjour, 3 éléments.')
    expect(lien).toBe('https://wa.me/22790123456?text=Bonjour%2C%203%20%C3%A9l%C3%A9ments.')
    expect(lienWhatsApp('abc', 'x')).toBeNull()
  })

  it('construit un lien mailto vers un ou plusieurs admins', () => {
    const lien = lienMailto(['a@b.c', 'd@e.f'], 'Sujet clair', 'Corps du message')
    expect(lien).toBe('mailto:a%40b.c,d%40e.f?subject=Sujet%20clair&body=Corps%20du%20message')
  })

  it('le message ne reprend que le résumé des files et le lien', () => {
    const texte = messageRelance('4 éléments en attente dans les files (le plus ancien depuis 5 h).', 'https://colokniamey.test')
    expect(texte).toBe(
      'Bonjour, 4 éléments en attente dans les files (le plus ancien depuis 5 h). Connecte-toi à l\'espace admin (connexion et double authentification) : https://colokniamey.test/admin',
    )
  })
})

describe('chaque rôle voit sa propre coque (RGA26)', () => {
  function monterSelecteur(role: 'admin' | 'super_admin') {
    definirRoleCourant(role)
    const SuperFaux = defineComponent({ template: '<div data-test="coque-super" />' })
    const AdminFaux = defineComponent({ template: '<div data-test="coque-admin" />' })
    return mount(CoqueSelecteur, { global: { stubs: { CoqueSuperAdmin: SuperFaux, CoqueAdmin: AdminFaux } } })
  }

  afterEach(() => definirRoleCourant(null))

  it('affiche la coque du super-admin', () => {
    const w = monterSelecteur('super_admin')
    expect(w.find('[data-test=coque-super]').exists()).toBe(true)
    expect(w.find('[data-test=coque-admin]').exists()).toBe(false)
  })

  it('affiche la coque de l\'admin', () => {
    const w = monterSelecteur('admin')
    expect(w.find('[data-test=coque-admin]').exists()).toBe(true)
    expect(w.find('[data-test=coque-super]').exists()).toBe(false)
  })

  async function monterCoque(composant: typeof CoqueAdmin | typeof CoqueSuperAdmin, role: 'admin' | 'super_admin') {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/:p*', component: { template: '<div />' }, meta: { titre: 'Utilisateurs' } }] })
    await router.push('/admin/utilisateurs')
    await router.isReady()
    const w = mount(composant, {
      props: { entrees: construireMenu(routesEnfantsAdmin, role) },
      global: {
        plugins: [router],
        stubs: { PanneauNotifications: true, BandeauRelance: true, BandeauMfa: true, AvertissementInactivite: true, ConteneurToasts: true },
      },
    })
    await flushPromises()
    return w
  }

  it('la coque super-admin a le badge SUPER-ADMIN et les sections Pilotage et Opérations', async () => {
    const w = await monterCoque(CoqueSuperAdmin, 'super_admin')
    expect(w.text()).toContain('SUPER-ADMIN')
    expect(w.text()).toContain('Pilotage')
    expect(w.text()).toContain('Opérations')
    expect(w.text()).toContain('Administrateurs')
  })

  it('la coque admin a le badge ADMIN, pas la page Administrateurs, et rappelle les fonctions du super-admin', async () => {
    const w = await monterCoque(CoqueAdmin, 'admin')
    expect(w.find('.badge').text()).toBe('ADMIN')
    expect(w.text()).not.toContain('Administrateurs')
    expect(w.text()).not.toContain('Pilotage')
    expect(w.text()).toContain('réservés au super-admin')
  })
})

describe('appel de l\'Edge Function admin-utilisateurs (RGA27)', () => {
  it('envoie l\'action, la cible et le motif', async () => {
    await executerAction('suspendre', 'cible-1', { motif: 'Propos répétés' })
    expect(mocks.invoke).toHaveBeenCalledWith('admin-utilisateurs', {
      body: { action: 'suspendre', cible_id: 'cible-1', motif: 'Propos répétés' },
    })
  })

  it('montre le refus en français renvoyé par la fonction', async () => {
    const reponse = new Response(JSON.stringify({ erreur: 'Cette action est réservée au super-administrateur.' }), { status: 400 })
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(reponse) })
    await expect(executerAction('supprimer_definitivement', 'cible-1', { motif: 'Test' })).rejects.toThrow('réservée au super-administrateur')
  })

  it('reste générique si la réponse est illisible', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(new Response('<html>', { status: 500 })) })
    await expect(executerAction('reactiver', 'cible-1')).rejects.toThrow('Une erreur est survenue. Réessaie dans un moment.')
  })
})
