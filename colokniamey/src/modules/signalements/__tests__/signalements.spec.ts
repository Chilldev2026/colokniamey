// M7 : bouton et formulaire de signalement, mes signalements, points d'extension, file admin.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
  liste: { value: [] as unknown[] },
  controler: vi.fn<(t: string, c: string) => Promise<string>>(),
  auth: { estConnecte: true, profil: { id: 'moi', role: 'etudiant' } },
  router: { push: vi.fn<(d: unknown) => Promise<void>>() },
}))

vi.mock('@/core/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: mocks.liste.value, error: null }) }) }) }),
  },
}))
vi.mock('@/modules/securite', () => ({ controlerTexte: mocks.controler, messageErreurContenu: (e: { message?: string } | null) => e?.message ?? 'Erreur' }))
vi.mock('@/modules/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ fullPath: '/annonces/3' }),
  useRouter: () => mocks.router,
}))

import { extensions } from '@/core/extensions'
import BoutonSignaler from '../components/BoutonSignaler.vue'
import SignalerAnnonce from '../components/SignalerAnnonce.vue'
import SignalerMessage from '../components/SignalerMessage.vue'
import { signalementsModule } from '../index'
import MesSignalementsView from '../views/MesSignalementsView.vue'
import SignalementsView from '../../admin/signalements/views/SignalementsView.vue'
import { construireMenu } from '../../admin/menu'
import { routesEnfantsAdmin } from '../../admin/routes'

const global = { stubs: { RouterLink: { template: '<a><slot /></a>' } } }

function boutonModale(texte: string): HTMLButtonElement {
  return Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent?.trim() === texte).pop() as HTMLButtonElement
}

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.rpc.mockReset()
  mocks.rpc.mockResolvedValue({ data: 1, error: null })
  mocks.controler.mockReset()
  mocks.controler.mockResolvedValue('accepte')
  mocks.router.push.mockReset()
  mocks.router.push.mockResolvedValue(undefined)
  mocks.auth.estConnecte = true
  mocks.auth.profil = { id: 'moi', role: 'etudiant' }
  document.body.innerHTML = ''
})

describe('branchement sur les autres modules', () => {
  it('s\'enregistre sur l\'annonce et sur les messages sans que ces modules l\'importent', () => {
    expect(extensions('annonce-detail')).toContain(SignalerAnnonce)
    expect(extensions('message-actions')).toContain(SignalerMessage)
    expect(signalementsModule.optionnel).toBe(true)
  })
})

describe('bouton et formulaire de signalement (RG20)', () => {
  it('un visiteur est invité à se connecter au lieu de signaler', async () => {
    mocks.auth.estConnecte = false
    const w = mount(BoutonSignaler, { props: { cible: 'annonce', cibleId: '3' } })
    await w.find('button.signaler').trigger('click')
    await flushPromises()
    expect(mocks.router.push).toHaveBeenCalledWith({ path: '/connexion', query: { redirect: '/annonces/3' } })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('la raison est obligatoire', async () => {
    const w = mount(BoutonSignaler, { props: { cible: 'annonce', cibleId: '3' }, attachTo: document.body })
    await w.find('button.signaler').trigger('click')
    await flushPromises()
    boutonModale('Envoyer le signalement').click()
    await flushPromises()
    expect(document.body.textContent).toContain('Choisis la raison')
    expect(mocks.rpc).not.toHaveBeenCalled()
    w.unmount()
  })

  it('envoie le signalement avec la raison et les précisions', async () => {
    const w = mount(BoutonSignaler, { props: { cible: 'message', cibleId: '12' }, attachTo: document.body })
    await w.find('button.signaler').trigger('click')
    await flushPromises()
    const select = document.body.querySelector('select') as HTMLSelectElement
    select.value = 'arnaque'
    select.dispatchEvent(new Event('change'))
    const texte = document.body.querySelector('textarea') as HTMLTextAreaElement
    texte.value = 'Il demande un acompte.'
    texte.dispatchEvent(new Event('input'))
    await flushPromises()
    boutonModale('Envoyer le signalement').click()
    await flushPromises()
    expect(mocks.controler).toHaveBeenCalledWith('Il demande un acompte.', 'prive')
    expect(mocks.rpc).toHaveBeenCalledWith('signaler', { p_cible_type: 'message', p_cible_id: '12', p_motif: 'arnaque', p_commentaire: 'Il demande un acompte.' })
    w.unmount()
  })

  it('affiche l\'erreur de la base (doublon, limite de 10 par jour)', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Tu as déjà signalé ce contenu : l\'équipe va le traiter.' } })
    const w = mount(BoutonSignaler, { props: { cible: 'annonce', cibleId: '3' }, attachTo: document.body })
    await w.find('button.signaler').trigger('click')
    await flushPromises()
    const select = document.body.querySelector('select') as HTMLSelectElement
    select.value = 'autre'
    select.dispatchEvent(new Event('change'))
    await flushPromises()
    boutonModale('Envoyer le signalement').click()
    await flushPromises()
    expect(document.body.textContent).toContain('déjà signalé ce contenu')
    w.unmount()
  })

  it('un commentaire interdit est refusé avant l\'envoi', async () => {
    mocks.controler.mockResolvedValue('bloque')
    const w = mount(BoutonSignaler, { props: { cible: 'annonce', cibleId: '3' }, attachTo: document.body })
    await w.find('button.signaler').trigger('click')
    await flushPromises()
    const select = document.body.querySelector('select') as HTMLSelectElement
    select.value = 'autre'
    select.dispatchEvent(new Event('change'))
    const texte = document.body.querySelector('textarea') as HTMLTextAreaElement
    texte.value = 'texte interdit'
    texte.dispatchEvent(new Event('input'))
    await flushPromises()
    boutonModale('Envoyer le signalement').click()
    await flushPromises()
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('ne respecte pas les règles')
    w.unmount()
  })

  it('l\'auteur d\'une annonce n\'a pas de bouton pour la signaler ; les autres en ont deux (annonce et annonceur)', () => {
    mocks.auth.profil = { id: 'proprio', role: 'proprietaire' }
    const auteur = mount(SignalerAnnonce, { props: { annonceId: 3, auteurId: 'proprio' }, global })
    expect(auteur.findAll('button')).toHaveLength(0)
    mocks.auth.profil = { id: 'moi', role: 'etudiant' }
    const autre = mount(SignalerAnnonce, { props: { annonceId: 3, auteurId: 'proprio' }, global })
    expect(autre.findAll('button').map((b) => b.text())).toEqual(['Signaler cette annonce', 'Signaler l\'annonceur'])
  })
})

describe('mes signalements', () => {
  it('montre le statut sans la décision détaillée', async () => {
    mocks.liste.value = [
      { id: 1, cible_type: 'annonce', motif: 'arnaque', commentaire: 'Suspect', statut: 'traite', created_at: '2026-10-01' },
      { id: 2, cible_type: 'message', motif: 'harcelement', commentaire: null, statut: 'nouveau', created_at: '2026-10-02' },
    ]
    const w = mount(MesSignalementsView, { global })
    await flushPromises()
    expect(w.text()).toContain('Annonce : Arnaque')
    expect(w.text()).toContain('Traité')
    expect(w.text()).toContain('Message : Harcèlement')
    expect(w.text()).toContain('Envoyé')
  })

  it('un état vide explique ce qu\'on peut signaler', async () => {
    mocks.liste.value = []
    const w = mount(MesSignalementsView, { global })
    await flushPromises()
    expect(w.text()).toContain('aucun signalement')
  })
})

describe('file admin des signalements (RGA12)', () => {
  const ligne = { id: 5, cible_type: 'annonce', motif: 'arnaque', statut: 'nouveau', nb_sur_la_cible: 2, pris_par_moi: false, pris_par_un_autre: false, created_at: '2026-10-01' }
  const fiche = (extra: Record<string, unknown> = {}) => ({
    id: 5, cible_type: 'annonce', cible_id: '3', cible_auteur_id: 'u9', motif: 'arnaque', commentaire: 'Demande un acompte', statut: 'nouveau', decision: null,
    decision_commentaire: null, cree_le: '2026-10-01', pris_par_moi: false, pris_par_un_autre: false, signale_par: 'Aïcha',
    cible: { annonce_id: 3, titre: 'Studio suspect', statut: 'publiee', description: 'Description', auteur: { id: 'u9', prenom: 'Awa', nom: 'Diallo', statut: 'actif' } },
    historique: [{ id: 4, motif: 'autre', statut: 'rejete', decision: 'rejeter', cree_le: '2026-09-01' }], autres_signalements_sur_la_personne: 1, ...extra,
  })
  function repondre(f: unknown) {
    mocks.rpc.mockImplementation((nom) => Promise.resolve({ data: nom === 'liste_signalements' ? [ligne] : nom === 'fiche_signalement' ? f : null, error: null }))
  }

  it('est dans le menu des admins, avec sa file', () => {
    expect(construireMenu(routesEnfantsAdmin, 'admin').map((e) => e.libelle)).toContain('Signalements')
    expect(routesEnfantsAdmin.find((r) => r.path === 'signalements')?.meta?.menuAdmin?.fileAdmin).toBe('signalements')
  })

  it('un nouveau signalement se prend en charge, sans bouton de décision avant', async () => {
    repondre(fiche())
    const w = mount(SignalementsView, { global })
    await flushPromises()
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Studio suspect')
    expect(w.text()).toContain('1 autre(s) signalement(s)')
    expect(w.text()).toContain('Autres signalements sur la même cible')
    const boutons = w.findAll('button').map((b) => b.text())
    expect(boutons).toContain('Prendre en charge')
    expect(boutons).not.toContain('Rejeter')
    await w.findAll('button').find((b) => b.text() === 'Prendre en charge')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('prendre_en_charge_signalement', { p_id: 5 })
  })

  it('l\'admin qui l\'a pris décide ; retirer ou suspendre exige un motif', async () => {
    repondre(fiche({ statut: 'en_cours', pris_par_moi: true }))
    const w = mount(SignalementsView, { global })
    await flushPromises()
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    const retirer = () => w.findAll('button').find((b) => b.text() === 'Retirer l\'annonce')!
    expect(retirer().attributes('disabled')).toBeDefined()
    await w.find('#commentaire-decision').setValue('Annonce trompeuse')
    expect(retirer().attributes('disabled')).toBeUndefined()
    await retirer().trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('cloturer_signalement', { p_id: 5, p_decision: 'retirer_annonce', p_commentaire: 'Annonce trompeuse' })
  })

  it('un signalement pris par un autre admin n\'offre aucune décision', async () => {
    repondre(fiche({ statut: 'en_cours', pris_par_un_autre: true }))
    const w = mount(SignalementsView, { global })
    await flushPromises()
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Un autre administrateur a pris ce signalement en charge')
    expect(w.findAll('button').map((b) => b.text())).not.toContain('Rejeter')
  })

  it('un message signalé n\'affiche que le message joint', async () => {
    repondre(fiche({ cible_type: 'message', cible: { message: 'Envoie un acompte.', envoye_le: '2026-10-01', auteur: { id: 'u9', prenom: 'Awa', nom: 'Diallo', statut: 'actif' } } }))
    const w = mount(SignalementsView, { global })
    await flushPromises()
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Envoie un acompte.')
    expect(w.text()).toContain('le reste de la conversation reste privé')
    expect(w.findAll('button').map((b) => b.text())).not.toContain('Retirer l\'annonce')
  })
})
