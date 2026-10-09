// A3 : file des annonces, photos, contenus et termes sensibles (droits par rôle, motif obligatoire).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
  deciderPhoto: vi.fn<(id: number, decision: string, motif?: string) => Promise<void>>(),
}))

vi.mock('@/core/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://x/s' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://x/p' } }),
      }),
    },
  },
}))
vi.mock('@/modules/securite', () => ({ deciderPhoto: mocks.deciderPhoto }))

import { definirRoleCourant } from '@/core/acces'
import { construireMenu } from '../../menu'
import { routesEnfantsAdmin } from '../../routes'
import AnnoncesModerationView from '../views/AnnoncesModerationView.vue'
import ContenusView from '../views/ContenusView.vue'
import PhotosModerationView from '../views/PhotosModerationView.vue'
import TermesView from '../views/TermesView.vue'

const global = { stubs: { RouterLink: { template: '<a><slot /></a>' }, CarteBase: true } }

function repondre(table: Record<string, unknown>) {
  mocks.rpc.mockImplementation((nom) => Promise.resolve({ data: table[nom] ?? [], error: null }))
}

function boutonModale(texte: string): HTMLButtonElement {
  return Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent?.trim() === texte).pop() as HTMLButtonElement
}

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.rpc.mockReset()
  mocks.deciderPhoto.mockReset()
  document.body.innerHTML = ''
})

describe('menu et routes (RGA26)', () => {
  it('les quatre écrans sont ouverts aux admins et aux super-admins, avec leurs files', () => {
    const menu = construireMenu(routesEnfantsAdmin, 'admin').map((e) => e.libelle)
    expect(menu).toEqual(expect.arrayContaining(['Annonces', 'Photos', 'Contenus', 'Termes sensibles']))
    const files = routesEnfantsAdmin.flatMap((r) => (r.meta?.menuAdmin?.fileAdmin ? [r.meta.menuAdmin.fileAdmin] : []))
    expect(files).toEqual(expect.arrayContaining(['annonces', 'photos', 'contenus']))
  })
})

describe('annonces à valider', () => {
  const ligne = { id: 4, titre: 'Studio calme', type: 'studio', auteur_id: 'u1', prenom: 'Aïcha', initiale_nom: 'M', en_revue: false, partie_le: '2026-10-01T10:00:00Z' }
  const fiche = {
    id: 4, titre: 'Studio calme', description: 'Un studio calme.', type: 'studio', statut: 'en_attente', nb_places: 1, part_mensuelle_fcfa: 50000,
    loyer_total_fcfa: null, charges_incluses: true, quartier: 'Plateau', universite: null, precision_position: 'approximative', latitude: 13.5, longitude: 2.1,
    zone_rayon_m: 150, en_revue: false, auteur: { id: 'u1', prenom: 'Aïcha', nom: 'Moussa', role: 'proprietaire', statut: 'actif' },
    regles: ['Pas de bruit'], taches: [], equipements: ['Climatisation'], photos: [{ id: 1, chemin: 'u1/a.webp', statut: 'en_attente' }],
  }

  it('liste, ouvre l\'aperçu et valide', async () => {
    repondre({ liste_annonces_a_valider: [ligne], annonce_a_moderer: fiche })
    const w = mount(AnnoncesModerationView, { global })
    await flushPromises()
    expect(w.text()).toContain('Studio calme')
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Aïcha Moussa')
    expect(w.text()).toContain('Zone approximative de 150 m')
    await w.findAll('button').find((b) => b.text() === 'Valider')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('valider_annonce', { p_id: 4 })
  })

  it('le refus exige un motif : bouton bloqué sans motif, puis appel avec le motif', async () => {
    repondre({ liste_annonces_a_valider: [ligne], annonce_a_moderer: fiche })
    const w = mount(AnnoncesModerationView, { global, attachTo: document.body })
    await flushPromises()
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Refuser')!.trigger('click')
    await flushPromises()
    expect(boutonModale('Refuser').disabled).toBe(true)
    const champ = document.body.querySelector('.boite input') as HTMLInputElement
    champ.value = 'Photos floues'
    champ.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(boutonModale('Refuser').disabled).toBe(false)
    boutonModale('Refuser').click()
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('refuser_annonce', { p_id: 4, p_motif: 'Photos floues' })
    w.unmount()
  })

  it('une annonce dont un texte est en revue ne peut pas être validée', async () => {
    repondre({ liste_annonces_a_valider: [{ ...ligne, en_revue: true }], annonce_a_moderer: { ...fiche, en_revue: true } })
    const w = mount(AnnoncesModerationView, { global })
    await flushPromises()
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    expect(w.findAll('button').find((b) => b.text() === 'Valider')!.attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Contenus à vérifier')
  })
})

describe('photos à valider', () => {
  const photo = { id: 9, usage: 'avatar', chemin: 'u1/a.webp', auteur_id: 'u1', prenom: 'Aïcha', initiale_nom: 'M', suspecte: true, created_at: '2026-10-01T10:00:00Z' }

  it('signale une photo déjà connue et valide par l\'Edge Function', async () => {
    repondre({ liste_photos_a_valider: [photo] })
    mocks.deciderPhoto.mockResolvedValue(undefined)
    const w = mount(PhotosModerationView, { global })
    await flushPromises()
    expect(w.text()).toContain('ressemble à une photo déjà utilisée')
    await w.findAll('button').find((b) => b.text() === 'Valider')!.trigger('click')
    await flushPromises()
    expect(mocks.deciderPhoto).toHaveBeenCalledWith(9, 'valider', undefined)
  })

  it('refuse avec un motif', async () => {
    repondre({ liste_photos_a_valider: [photo] })
    mocks.deciderPhoto.mockResolvedValue(undefined)
    const w = mount(PhotosModerationView, { global, attachTo: document.body })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Refuser')!.trigger('click')
    await flushPromises()
    const champ = document.body.querySelector('.boite input') as HTMLInputElement
    champ.value = 'Visage non visible'
    champ.dispatchEvent(new Event('input'))
    await flushPromises()
    boutonModale('Refuser').click()
    await flushPromises()
    expect(mocks.deciderPhoto).toHaveBeenCalledWith(9, 'refuser', 'Visage non visible')
    w.unmount()
  })
})

describe('contenus à vérifier et récidives', () => {
  it('montre le texte en contexte, les catégories et les comptes à surveiller, puis publie', async () => {
    repondre({
      liste_contenus_a_verifier: [{ id: 2, type_contenu: 'annonce', categories: ['sexuel'], auteur_id: 'u1', prenom: 'Aïcha', created_at: '2026-10-01T10:00:00Z' }],
      liste_recidives: [{ user_id: 'u2', prenom: 'Moussa', initiale_nom: 'K', nombre: 3, dernier: '2026-10-02T10:00:00Z' }],
      contenu_a_verifier: [{ champ: 'Titre', valeur: 'Chambre calme' }],
    })
    const w = mount(ContenusView, { global })
    await flushPromises()
    expect(w.text()).toContain('Comptes à surveiller')
    expect(w.text()).toContain('3 blocages')
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Sexuel')
    expect(w.text()).toContain('Chambre calme')
    await w.findAll('button').find((b) => b.text() === 'Publier')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('decider_contenu', { p_id: 2, p_publier: true })
  })
})

describe('termes sensibles (RGA28)', () => {
  const termes = [
    { id: 1, terme: 'zzmot', categorie: 'violence', niveau: 'blocage', langue: 'ha', actif: true, valide: false, propose_par_moi: true, created_at: '2026-10-01' },
    { id: 2, terme: 'autremot', categorie: 'haine', niveau: 'revue', langue: 'fr', actif: true, valide: true, propose_par_moi: false, created_at: '2026-09-01' },
  ]

  it('un admin propose mais ne voit aucun bouton Valider, Modifier ni Rejeter', async () => {
    definirRoleCourant('admin')
    repondre({ liste_termes: termes })
    const w = mount(TermesView, { global })
    await flushPromises()
    const boutons = w.findAll('button').map((b) => b.text())
    expect(boutons).toContain('Proposer')
    expect(boutons).not.toContain('Valider')
    expect(boutons).not.toContain('Modifier')
    expect(boutons).not.toContain('Rejeter')
    expect(w.text()).toContain('Inactif : en attente de validation')
    definirRoleCourant(null)
  })

  it('le super-admin valide, désactive et rejette', async () => {
    definirRoleCourant('super_admin')
    repondre({ liste_termes: termes })
    const w = mount(TermesView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Valider')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('valider_terme', { p_id: 1 })
    await w.findAll('button').find((b) => b.text() === 'Désactiver')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('definir_terme_actif', { p_id: 2, p_actif: false })
    await w.findAll('button').find((b) => b.text() === 'Rejeter')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('rejeter_terme', { p_id: 1 })
    definirRoleCourant(null)
  })

  it('refuse un terme trop court sans appeler la base', async () => {
    definirRoleCourant('admin')
    repondre({ liste_termes: [] })
    const w = mount(TermesView, { global })
    await flushPromises()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('au moins 3 caractères')
    expect(mocks.rpc.mock.calls.some((c) => c[0] === 'proposer_terme')).toBe(false)
    definirRoleCourant(null)
  })
})
