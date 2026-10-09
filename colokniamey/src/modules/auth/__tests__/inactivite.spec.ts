// RGP28 : un étudiant inactif depuis plus de 7 jours est déconnecté à l'ouverture, avant tout affichage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const JOUR = 86_400_000
const mocks = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<{ error: null }>>(() => Promise.resolve({ error: null })),
  getSession: vi.fn<() => Promise<unknown>>(),
  profil: { data: null as unknown },
}))

vi.mock('@/core/supabase', () => {
  const requete = { select: () => requete, eq: () => requete, maybeSingle: () => Promise.resolve({ data: mocks.profil.data, error: null }) }
  return {
    supabase: {
      auth: {
        getSession: mocks.getSession,
        signOut: mocks.signOut,
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from: () => requete,
      rpc: () => Promise.resolve({ data: null, error: null }),
    },
  }
})

import { effacerInactivite, inactiviteDepassee, reinitialiserInactivite } from '@/core/useInactivite'
import { roleCourant } from '@/core/acces'
import { useAuthStore } from '../stores/authStore'

function profil(role: 'etudiant' | 'proprietaire') {
  return {
    id: 'u1', nom: 'N', prenom: 'P', telephone: '90000000', role, statut: 'actif',
    motif_suspension: null, suspendu_jusqua: null, cgu_version: '1.0',
    cgu_acceptee_le: '2026-01-01T00:00:00Z', created_at: '', updated_at: '',
  }
}

const NOW = new Date('2026-10-09T10:00:00Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  setActivePinia(createPinia())
  mocks.signOut.mockClear()
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  effacerInactivite()
})

afterEach(() => {
  vi.useRealTimers()
  effacerInactivite()
})

describe('inactiviteDepassee', () => {
  it('est vraie au-delà du délai, fausse en deçà', () => {
    reinitialiserInactivite(NOW - 8 * JOUR)
    expect(inactiviteDepassee(7 * JOUR, NOW)).toBe(true)
    reinitialiserInactivite(NOW - 6 * JOUR)
    expect(inactiviteDepassee(7 * JOUR, NOW)).toBe(false)
  })

  it('ne déconnecte pas sans trace d\'activité', () => {
    expect(inactiviteDepassee(7 * JOUR, NOW)).toBe(false)
  })
})

describe('ouverture de l\'application (RGP28)', () => {
  it('déconnecte un étudiant inactif depuis 8 jours avant tout affichage', async () => {
    mocks.profil.data = profil('etudiant')
    reinitialiserInactivite(NOW - 8 * JOUR)
    const auth = useAuthStore()
    await auth.initialiser()
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(auth.estConnecte).toBe(false)
    expect(roleCourant.value).toBeNull()
    expect(auth.raisonDeconnexion).toBe('inactivite')
  })

  it('garde un étudiant actif depuis 6 jours', async () => {
    mocks.profil.data = profil('etudiant')
    reinitialiserInactivite(NOW - 6 * JOUR)
    const auth = useAuthStore()
    await auth.initialiser()
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(auth.estConnecte).toBe(true)
    expect(roleCourant.value).toBe('etudiant')
  })

  it('laisse un propriétaire jusqu\'à 14 jours', async () => {
    mocks.profil.data = profil('proprietaire')
    reinitialiserInactivite(NOW - 10 * JOUR)
    const auth = useAuthStore()
    await auth.initialiser()
    expect(auth.estConnecte).toBe(true)
  })

  it('déconnecte un propriétaire inactif depuis 15 jours', async () => {
    mocks.profil.data = profil('proprietaire')
    reinitialiserInactivite(NOW - 15 * JOUR)
    const auth = useAuthStore()
    await auth.initialiser()
    expect(auth.estConnecte).toBe(false)
    expect(auth.raisonDeconnexion).toBe('inactivite')
  })
})
