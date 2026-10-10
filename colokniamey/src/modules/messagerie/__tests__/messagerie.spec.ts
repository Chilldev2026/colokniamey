// M6 : liste des conversations, fil en temps réel, envoi, premier message depuis une annonce.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
  insert: vi.fn<(valeurs: unknown) => unknown>(),
  lignes: { value: [] as unknown[] },
  surMessage: { fn: null as null | ((charge: { new: Record<string, unknown> }) => void) },
  removeChannel: vi.fn<(c: unknown) => void>(),
  controler: vi.fn<(t: string, c: string) => Promise<string>>(),
  route: { params: {} as Record<string, string> },
  router: { replace: vi.fn<(d: unknown) => Promise<void>>(), push: vi.fn<(d: unknown) => Promise<void>>() },
  annonce: { value: null as null | Record<string, unknown> },
}))

vi.mock('@/core/supabase', () => {
  const canal = {
    on: (_t: string, _f: unknown, cb: (c: { new: Record<string, unknown> }) => void) => {
      mocks.surMessage.fn = cb
      return canal
    },
    subscribe: () => canal,
  }
  return {
    supabase: {
      rpc: mocks.rpc,
      channel: () => canal,
      removeChannel: mocks.removeChannel,
      from: () => ({
        select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: () => Promise.resolve({ data: mocks.lignes.value, error: null }) }) }) }) }),
        insert: (valeurs: unknown) => ({
          select: () => ({ single: () => Promise.resolve(mocks.insert(valeurs)) }),
        }),
      }),
    },
  }
})
vi.mock('@/modules/securite', () => ({ controlerTexte: mocks.controler, messageErreurContenu: (e: { message?: string } | null) => e?.message ?? 'Erreur' }))
vi.mock('@/modules/annonces', () => ({ lireAnnonceDetail: () => Promise.resolve(mocks.annonce.value) }))
vi.mock('@/modules/auth', () => ({ useAuthStore: () => ({ profil: { id: 'moi' } }) }))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}))

import { routesMessagerie } from '../routes'
import ConversationsView from '../views/ConversationsView.vue'
import ConversationView from '../views/ConversationView.vue'
import NouveauMessageView from '../views/NouveauMessageView.vue'

const global = { stubs: { RouterLink: { template: '<a><slot /></a>' } } }

function ligne(id: number, de: string, contenu: string) {
  return { id, conversation_id: 7, expediteur_id: de, contenu, lu_le: null, created_at: '2026-10-01T10:00:00Z' }
}

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.rpc.mockReset()
  mocks.insert.mockReset()
  mocks.controler.mockReset()
  mocks.controler.mockResolvedValue('accepte')
  mocks.router.replace.mockReset()
  mocks.router.replace.mockResolvedValue(undefined)
  mocks.removeChannel.mockReset()
  mocks.surMessage.fn = null
  mocks.lignes.value = []
  mocks.annonce.value = null
})

describe('routes (RG19)', () => {
  it('tout exige une connexion et un rôle d\'utilisateur', () => {
    expect(routesMessagerie.length).toBe(3)
    for (const r of routesMessagerie) {
      expect(r.meta?.connexionRequise).toBe(true)
      expect(r.meta?.roles).toEqual(['etudiant', 'proprietaire'])
    }
  })
})

describe('liste des conversations', () => {
  it('montre l\'autre personne (prénom et initiale), l\'annonce et les non lus', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { id: 7, annonce_id: 3, annonce_titre: 'Studio calme', autre_id: 'u2', autre_prenom: 'Aïcha', autre_initiale: 'M', dernier_message_le: '2020-01-01T10:00:00Z', non_lus: 2 },
        { id: 8, annonce_id: null, annonce_titre: null, autre_id: 'u3', autre_prenom: 'Ancien membre', autre_initiale: '', dernier_message_le: '2020-01-01T10:00:00Z', non_lus: 0 },
      ],
      error: null,
    })
    const w = mount(ConversationsView, { global })
    await flushPromises()
    expect(w.text()).toContain('Aïcha M.')
    expect(w.text()).toContain('Studio calme')
    expect(w.find('.non-lus').text()).toBe('2')
    expect(w.text()).toContain('Annonce retirée')
    expect(w.text()).toContain('Ancien membre')
  })

  it('un état vide explique comment contacter quelqu\'un', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    const w = mount(ConversationsView, { global })
    await flushPromises()
    expect(w.text()).toContain('pas encore de conversation')
    expect(w.text()).toContain('Envoyer un message')
  })
})

describe('fil d\'une conversation', () => {
  beforeEach(() => {
    mocks.route.params = { id: '7' }
    mocks.rpc.mockImplementation((nom) =>
      Promise.resolve({
        data: nom === 'liste_conversations'
          ? [{ id: 7, annonce_id: 3, annonce_titre: 'Studio calme', autre_id: 'u2', autre_prenom: 'Aïcha', autre_initiale: 'M', dernier_message_le: '2026-10-01', non_lus: 1 }]
          : 1,
        error: null,
      }),
    )
  })

  it('affiche les messages, marque comme lu et s\'abonne en temps réel', async () => {
    mocks.lignes.value = [ligne(1, 'u2', 'Bonjour'), ligne(2, 'moi', 'Salut')]
    const w = mount(ConversationView, { global })
    await flushPromises()
    expect(w.findAll('.message')).toHaveLength(2)
    expect(w.findAll('.message.moi')).toHaveLength(1)
    expect(mocks.rpc).toHaveBeenCalledWith('marquer_lu', { p_conversation_id: 7 })
    expect(mocks.surMessage.fn).not.toBeNull()
  })

  it('un message reçu en direct s\'ajoute une seule fois et est marqué comme lu', async () => {
    mocks.lignes.value = [ligne(1, 'u2', 'Bonjour')]
    const w = mount(ConversationView, { global })
    await flushPromises()
    mocks.rpc.mockClear()
    const recu = { id: 5, conversation_id: 7, expediteur_id: 'u2', contenu: 'Nouveau !', lu_le: null, created_at: '2026-10-01T11:00:00Z' }
    mocks.surMessage.fn!({ new: recu })
    mocks.surMessage.fn!({ new: recu })
    await flushPromises()
    expect(w.findAll('.message')).toHaveLength(2)
    expect(w.text()).toContain('Nouveau !')
    expect(mocks.rpc).toHaveBeenCalledWith('marquer_lu', { p_conversation_id: 7 })
  })

  it('envoie un message après le contrôle de texte, sans doublon avec l\'écho temps réel', async () => {
    mocks.insert.mockReturnValue({ data: ligne(9, 'moi', 'Je viens demain'), error: null })
    const w = mount(ConversationView, { global })
    await flushPromises()
    await w.find('textarea').setValue('Je viens demain')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.controler).toHaveBeenCalledWith('Je viens demain', 'prive')
    expect(mocks.insert).toHaveBeenCalledWith({ conversation_id: 7, contenu: 'Je viens demain' })
    mocks.surMessage.fn!({ new: ligne(9, 'moi', 'Je viens demain') })
    await flushPromises()
    expect(w.findAll('.message')).toHaveLength(1)
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('un message interdit est refusé avant l\'envoi, sans détail sur le terme', async () => {
    mocks.controler.mockResolvedValue('bloque')
    const w = mount(ConversationView, { global })
    await flushPromises()
    await w.find('textarea').setValue('texte interdit')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(w.text()).toContain('ne respecte pas les règles')
    expect(w.text()).not.toContain('interdit')
  })

  it('affiche l\'erreur de la base (ex. limite de messages par minute)', async () => {
    mocks.insert.mockReturnValue({ data: null, error: { code: 'P0001', message: 'Tu fais trop de demandes. Réessaie dans un moment.' } })
    const w = mount(ConversationView, { global })
    await flushPromises()
    await w.find('textarea').setValue('Encore un message')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('trop de demandes')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('Encore un message')
  })

  it('ferme l\'abonnement en quittant la page', async () => {
    const w = mount(ConversationView, { global })
    await flushPromises()
    w.unmount()
    expect(mocks.removeChannel).toHaveBeenCalled()
  })

  it('un message vide ne peut pas être envoyé', async () => {
    const w = mount(ConversationView, { global })
    await flushPromises()
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})

describe('premier message depuis une annonce (RG19)', () => {
  beforeEach(() => {
    mocks.route.params = { annonceId: '3' }
  })

  it('reprend la conversation existante au lieu d\'en créer une', async () => {
    mocks.rpc.mockResolvedValue({ data: 12, error: null })
    mount(NouveauMessageView, { global })
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('ma_conversation_annonce', { p_annonce_id: 3 })
    expect(mocks.router.replace).toHaveBeenCalledWith('/messages/12')
  })

  it('propose un message prérempli et démarre la conversation', async () => {
    mocks.annonce.value = { id: 3, auteurId: 'u2', statut: 'publiee', titre: 'Studio calme' }
    mocks.rpc.mockImplementation((nom) => Promise.resolve({ data: nom === 'demarrer_conversation' ? 21 : null, error: null }))
    const w = mount(NouveauMessageView, { global })
    await flushPromises()
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toContain('Studio calme')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('demarrer_conversation', expect.objectContaining({ p_annonce_id: 3 }))
    expect(mocks.router.replace).toHaveBeenCalledWith('/messages/21')
  })

  it('refuse d\'écrire à sa propre annonce', async () => {
    mocks.annonce.value = { id: 3, auteurId: 'moi', statut: 'publiee', titre: 'Mon studio' }
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    const w = mount(NouveauMessageView, { global })
    await flushPromises()
    expect(w.text()).toContain('tu ne peux pas t\'écrire à toi-même')
    expect(w.find('form').exists()).toBe(false)
  })

  it('une annonce non publiée n\'est pas contactable', async () => {
    mocks.annonce.value = { id: 3, auteurId: 'u2', statut: 'brouillon', titre: 'Brouillon' }
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    const w = mount(NouveauMessageView, { global })
    await flushPromises()
    expect(w.text()).toContain('n\'est plus disponible')
  })
})
