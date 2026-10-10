// M8 : section « groupes » du détail d'une annonce, mes groupes, point d'extension.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
  controler: vi.fn<(t: string, c: string) => Promise<string>>(),
  verifiee: vi.fn<(id: string) => Promise<boolean>>(),
  auth: { estConnecte: true, profil: { id: 'moi', role: 'etudiant' as string } },
}))

vi.mock('@/core/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
vi.mock('@/modules/securite', () => ({
  controlerTexte: mocks.controler,
  messageErreurContenu: (e: { message?: string } | null) => e?.message ?? 'Erreur',
}))
vi.mock('@/modules/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/modules/identite', () => ({
  lireIdentiteVerifiee: mocks.verifiee,
  BandeauIdentite: { template: '<div class="bandeau-identite">Vérifie ton identité</div>' },
}))

import { extensions } from '@/core/extensions'
import { parametres } from '@/core/parametres'
import { groupesModule } from '../index'
import SectionGroupes from '../components/SectionGroupes.vue'
import MesGroupesView from '../views/MesGroupesView.vue'

const global = { stubs: { RouterLink: { template: '<a><slot /></a>' } } }
const props = { annonceId: 3, type: 'appartement', auteurId: 'proprio', nbPlaces: 4, publiee: true }

function groupe(extra: Record<string, unknown> = {}) {
  return {
    id: 10, initiateur_id: 'u2', initiateur_prenom: 'Aïcha', initiateur_initiale: 'M', places_recherchees: 2, membres: 1, places_restantes: 2,
    part_estimee_fcfa: 30000, message: 'Nous cherchons des étudiants sérieux.', preferences: 'Non fumeurs', statut: 'en_formation', mon_statut: null, ...extra,
  }
}

function repondre(table: Record<string, unknown>) {
  mocks.rpc.mockImplementation((nom) => Promise.resolve({ data: table[nom] ?? (nom === 'creer_groupe' ? 77 : null), error: null }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.rpc.mockReset()
  mocks.controler.mockReset()
  mocks.controler.mockResolvedValue('accepte')
  mocks.verifiee.mockReset()
  mocks.verifiee.mockResolvedValue(true)
  mocks.auth.estConnecte = true
  mocks.auth.profil = { id: 'moi', role: 'etudiant' }
  parametres.value.kyc_actif = false
})

describe('point d\'extension', () => {
  it('le module se branche sur le détail d\'une annonce sans que M4 l\'importe', () => {
    expect(extensions('annonce-detail')).toContain(SectionGroupes)
    expect(groupesModule.optionnel).toBe(true)
    expect(groupesModule.menu[0]?.roles).toEqual(['etudiant'])
  })
})

describe('section groupes du détail d\'un logement', () => {
  it('montre les groupes en formation avec places restantes et part estimée, et propose les deux actions (RG35, RG37)', async () => {
    repondre({ groupes_du_logement: [groupe()] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    expect(w.text()).toContain('Des étudiants cherchent déjà des colocataires ici')
    expect(w.text()).toContain('Groupe de Aïcha M.')
    expect(w.text()).toContain('1 sur 3 places remplies')
    expect(w.text()).toContain('30 000 FCFA')
    expect(w.text()).toContain('Non fumeurs')
    const boutons = w.findAll('button').map((b) => b.text())
    expect(boutons).toEqual(expect.arrayContaining(['Demander à rejoindre', 'Lancer mon groupe']))
  })

  it('sans groupe, seule l\'action « Lancer mon groupe » est proposée', async () => {
    repondre({ groupes_du_logement: [] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    expect(w.text()).toContain('Forme ton groupe')
    const boutons = w.findAll('button').map((b) => b.text())
    expect(boutons).toContain('Lancer mon groupe')
    expect(boutons).not.toContain('Demander à rejoindre')
  })

  it('la demande d\'adhésion appelle la base', async () => {
    repondre({ groupes_du_logement: [groupe()] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Demander à rejoindre')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('demander_adhesion', { p_groupe_id: 10 })
  })

  it('avant de lancer un groupe, rappelle les groupes existants puis envoie le formulaire (RG35)', async () => {
    repondre({ groupes_du_logement: [groupe()] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Lancer mon groupe')!.trigger('click')
    expect(w.text()).toContain('Des groupes existent déjà')
    expect(w.findAll('#places option').map((o) => o.text())).toEqual(['1', '2', '3'])
    await w.find('#places').setValue('2')
    await w.find('#message-groupe').setValue('Bonjour, nous cherchons deux colocataires.')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.controler).toHaveBeenCalledWith('Bonjour, nous cherchons deux colocataires.', 'public')
    expect(mocks.rpc).toHaveBeenCalledWith('creer_groupe', expect.objectContaining({ p_annonce_id: 3, p_places: 2 }))
  })

  it('un texte interdit est refusé avant l\'envoi', async () => {
    mocks.controler.mockResolvedValue('bloque')
    repondre({ groupes_du_logement: [] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Lancer mon groupe')!.trigger('click')
    await w.find('#message-groupe').setValue('texte interdit')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.rpc.mock.calls.some((c) => c[0] === 'creer_groupe')).toBe(false)
    expect(w.text()).toContain('ne respecte pas les règles')
  })

  it('un étudiant non vérifié (KYC actif) voit le bandeau de vérification et ne peut ni lancer ni rejoindre (RG52)', async () => {
    parametres.value.kyc_actif = true
    mocks.verifiee.mockResolvedValue(false)
    repondre({ groupes_du_logement: [groupe()] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    expect(w.find('.bandeau-identite').exists()).toBe(true)
    expect(w.findAll('button').find((b) => b.text() === 'Demander à rejoindre')!.attributes('disabled')).toBeDefined()
    expect(w.findAll('button').find((b) => b.text() === 'Lancer mon groupe')!.attributes('disabled')).toBeDefined()
  })

  it('avec le KYC désactivé (RG59), le bandeau n\'apparaît pas et les actions restent ouvertes', async () => {
    mocks.verifiee.mockResolvedValue(false)
    repondre({ groupes_du_logement: [groupe()] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    expect(w.find('.bandeau-identite').exists()).toBe(false)
    expect(w.findAll('button').find((b) => b.text() === 'Lancer mon groupe')!.attributes('disabled')).toBeUndefined()
  })

  it('le message d\'erreur de la base est affiché, avec le lien vers la vérification', async () => {
    repondre({ groupes_du_logement: [groupe()] })
    mocks.rpc.mockImplementation((nom) =>
      Promise.resolve(
        nom === 'groupes_du_logement'
          ? { data: [groupe()], error: null }
          : { data: null, error: { code: 'P0001', message: 'Vérifie ton identité avant de former ou rejoindre un groupe.' } },
      ),
    )
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Demander à rejoindre')!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Vérifie ton identité avant de former')
    expect(w.text()).toContain('Vérifier mon identité')
  })

  it('un groupe complet n\'a plus de bouton pour rejoindre', async () => {
    repondre({ groupes_du_logement: [groupe({ statut: 'complet', places_restantes: 0, membres: 3 })] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    expect(w.text()).toContain('Complet')
    expect(w.findAll('button').map((b) => b.text())).not.toContain('Demander à rejoindre')
  })

  it('une demande en attente et l\'appartenance sont signalées ; on ne peut pas lancer un second groupe', async () => {
    repondre({ groupes_du_logement: [groupe({ mon_statut: 'en_attente' })] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    expect(w.text()).toContain('Demande envoyée')
    expect(w.findAll('button').map((b) => b.text())).not.toContain('Lancer mon groupe')
  })

  it('le propriétaire de l\'annonce voit « Groupes intéressés », sans aucune action', async () => {
    mocks.auth.profil = { id: 'proprio', role: 'proprietaire' }
    repondre({ groupes_du_logement: [groupe({ statut: 'complet', places_restantes: 0 })] })
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    expect(w.text()).toContain('Groupes intéressés')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('un visiteur est invité à se connecter, sans appel à la base', async () => {
    mocks.auth.estConnecte = false
    const w = mount(SectionGroupes, { props, global })
    await flushPromises()
    expect(w.text()).toContain('Connecte-toi')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('n\'affiche rien sur une place en colocation ni sur une annonce non publiée', async () => {
    repondre({ groupes_du_logement: [] })
    const a = mount(SectionGroupes, { props: { ...props, type: 'place_colocation' }, global })
    const b = mount(SectionGroupes, { props: { ...props, publiee: false }, global })
    await flushPromises()
    expect(a.text()).toBe('')
    expect(b.text()).toBe('')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('un logement d\'une seule place n\'a pas de groupe à former', async () => {
    repondre({ groupes_du_logement: [] })
    const w = mount(SectionGroupes, { props: { ...props, nbPlaces: 1 }, global })
    await flushPromises()
    expect(w.text()).toContain('qu\'une place')
    expect(w.findAll('button').map((b) => b.text())).not.toContain('Lancer mon groupe')
  })
})

describe('mes groupes', () => {
  const mon = { id: 10, annonce_id: 3, annonce_titre: 'Appartement', statut: 'en_formation', mon_role: 'initiateur', mon_statut: 'accepte', places_recherchees: 2, membres: 1, demandes_en_attente: 1, part_estimee_fcfa: 30000, derniere_activite: '2026-10-01' }
  const membres = [
    { membre_id: 1, user_id: 'moi', prenom: 'Moi', initiale: 'X', role: 'initiateur', statut: 'accepte' },
    { membre_id: 2, user_id: 'u3', prenom: 'Awa', initiale: 'D', role: 'membre', statut: 'en_attente' },
  ]

  it('l\'initiateur accepte ou refuse une demande reçue', async () => {
    repondre({ mes_groupes: [mon], membres_du_groupe: membres })
    const w = mount(MesGroupesView, { global })
    await flushPromises()
    expect(w.text()).toContain('Demande reçue')
    await w.findAll('button').find((b) => b.text() === 'Accepter')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('repondre_demande', { p_membre_id: 2, p_accepter: true })
    await w.findAll('button').find((b) => b.text() === 'Refuser')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('repondre_demande', { p_membre_id: 2, p_accepter: false })
  })

  it('un simple membre ne voit aucun bouton Accepter ni Refuser', async () => {
    repondre({ mes_groupes: [{ ...mon, mon_role: 'membre', demandes_en_attente: 0 }], membres_du_groupe: [membres[0]] })
    const w = mount(MesGroupesView, { global })
    await flushPromises()
    const boutons = w.findAll('button').map((b) => b.text())
    expect(boutons).not.toContain('Accepter')
    expect(boutons).toContain('Quitter le groupe')
  })

  it('quitter demande une confirmation', async () => {
    repondre({ mes_groupes: [mon], membres_du_groupe: [membres[0]] })
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const w = mount(MesGroupesView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Quitter le groupe')!.trigger('click')
    await flushPromises()
    expect(confirmer).toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledWith('quitter_groupe', { p_groupe_id: 10 })
    confirmer.mockRestore()
  })

  it('un groupe clos n\'a plus de bouton pour le quitter ; l\'état vide explique quoi faire', async () => {
    repondre({ mes_groupes: [{ ...mon, statut: 'cloture' }], membres_du_groupe: [] })
    const w = mount(MesGroupesView, { global })
    await flushPromises()
    expect(w.text()).toContain('Clos')
    expect(w.findAll('button').map((b) => b.text())).not.toContain('Quitter le groupe')

    repondre({ mes_groupes: [] })
    const vide = mount(MesGroupesView, { global })
    await flushPromises()
    expect(vide.text()).toContain('pas encore de groupe')
  })
})
