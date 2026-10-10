// A4 : bandeau (masquage, critique non masquable), point d'extension, formulaire admin (niveau critique réservé au super-admin).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
  select: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
}))

vi.mock('@/core/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ order: () => ({ limit: mocks.select }) }) }),
  },
}))

import { definirRoleCourant } from '@/core/acces'
import { extensions } from '@/core/extensions'
import { communiquesModule } from '../index'
import BandeauCommunique from '../components/BandeauCommunique.vue'
import CommuniquesView from '../../admin/communiques/views/CommuniquesView.vue'
import { etatCommunique, validerCommunique } from '../../admin/communiques/services/communiquesAdminService'

const actifs = [
  { id: 1, titre: 'Info', message: 'Un message', niveau: 'information', debut: '', fin: '', masquable: true },
  { id: 2, titre: 'Urgent', message: 'Maintenance ce soir', niveau: 'critique', debut: '', fin: '', masquable: false },
]

describe('A4 : bandeau des communiqués', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    definirRoleCourant('etudiant')
    mocks.rpc.mockImplementation((nom) => Promise.resolve({ data: nom === 'communiques_actifs' ? actifs : null, error: null }))
  })

  it("s'enregistre dans la zone de communiqué et reste optionnel", () => {
    expect(extensions('zone-communique')).toContain(BandeauCommunique)
    expect(communiquesModule.optionnel).toBe(true)
  })

  it("n'offre pas le bouton Masquer pour un communiqué critique", async () => {
    const w = mount(BandeauCommunique)
    await flushPromises()
    expect(w.findAll('article')).toHaveLength(2)
    expect(w.findAll('button.masquer')).toHaveLength(1)
  })

  it('masque pour un utilisateur connecté par la base', async () => {
    const w = mount(BandeauCommunique)
    await flushPromises()
    await w.find('button.masquer').trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('masquer_communique', { p_id: 1 })
    expect(w.findAll('article')).toHaveLength(1)
  })

  it('masque pour un visiteur dans son navigateur seulement', async () => {
    definirRoleCourant(null)
    const w = mount(BandeauCommunique)
    await flushPromises()
    await w.find('button.masquer').trigger('click')
    await flushPromises()
    expect(mocks.rpc).not.toHaveBeenCalledWith('masquer_communique', expect.anything())
    expect(localStorage.getItem('colokniamey-communiques-masques')).toBe('[1]')
    const w2 = mount(BandeauCommunique)
    await flushPromises()
    expect(w2.findAll('article')).toHaveLength(1)
  })

  it("n'affiche rien si la lecture échoue", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    const w = mount(BandeauCommunique)
    await flushPromises()
    expect(w.find('.communiques').exists()).toBe(false)
  })
})

describe('A4 : gestion côté admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.select.mockResolvedValue({ data: [], error: null })
  })

  it('propose le niveau critique au super-admin seulement', async () => {
    definirRoleCourant('admin')
    const a = mount(CommuniquesView)
    await flushPromises()
    await a.find('button').trigger('click')
    expect(a.html()).not.toContain('Critique')
    definirRoleCourant('super_admin')
    const s = mount(CommuniquesView)
    await flushPromises()
    await s.find('button').trigger('click')
    expect(s.html()).toContain('Critique')
  })

  it('calcule l\'état et valide la période', () => {
    const maintenant = Date.parse('2026-10-10T12:00:00Z')
    expect(etatCommunique({ debut: '2026-10-11T00:00:00Z', fin: '2026-10-12T00:00:00Z' }, maintenant)).toBe('programme')
    expect(etatCommunique({ debut: '2026-10-09T00:00:00Z', fin: '2026-10-12T00:00:00Z' }, maintenant)).toBe('en_cours')
    expect(etatCommunique({ debut: '2026-10-08T00:00:00Z', fin: '2026-10-09T00:00:00Z' }, maintenant)).toBe('termine')
    const base = { titre: 'Titre', message: 'Message', niveau: 'information' as const, cible: 'tous' as const }
    expect(validerCommunique({ ...base, debut: '2026-10-10T10:00', fin: '2026-10-10T09:00' }).fin).toBeDefined()
    expect(validerCommunique({ ...base, titre: 'a', debut: '2026-10-10T10:00', fin: '2026-10-11T09:00' }).titre).toBeDefined()
    expect(validerCommunique({ ...base, debut: '2026-10-10T10:00', fin: '2026-10-11T09:00' })).toEqual({})
  })
})
