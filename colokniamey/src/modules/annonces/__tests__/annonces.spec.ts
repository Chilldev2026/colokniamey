// M4 : contrôles du formulaire, géolocalisation, mes annonces, détail et contact, étapes de l'éditeur.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
  service: {
    listerMesAnnonces: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    soumettreAnnonce: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    archiverAnnonce: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    rouvrirAnnonce: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    supprimerAnnonce: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    lireAnnonceDetail: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    lireContactAnnonce: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    listerEquipements: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    creerAnnonce: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    modifierAnnonce: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    lireAnnoncePourEdition: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    synchroniserEquipements: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    synchroniserRegles: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    synchroniserTaches: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  },
  route: { params: {} as Record<string, string>, query: {} as Record<string, string>, fullPath: '/annonces/7' },
  router: { push: vi.fn<(destination: unknown) => void>(), replace: vi.fn<(destination: unknown) => void>() },
  connecte: { value: true },
  role: { value: 'proprietaire' as 'proprietaire' | 'etudiant' },
}))

vi.mock('@/core/supabase', () => ({ supabase: { rpc: mocks.rpc, storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://x/p.webp' } }) }) } } }))
vi.mock('../services/annoncesService', () => ({
  ...mocks.service,
  listerPhotosAnnonce: vi.fn<() => Promise<never[]>>().mockResolvedValue([]),
  urlPhotoPublique: (c: string) => `https://x/${c}`,
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}))
vi.mock('@/modules/auth', () => ({
  useAuthStore: () => ({ estConnecte: mocks.connecte.value, profil: { id: 'u1', role: mocks.role.value, prenom: 'Aïcha' } }),
}))
vi.mock('@/modules/referentiel', () => ({
  listerVilles: vi.fn<() => Promise<object[]>>().mockResolvedValue([{ id: 1, nom: 'Niamey', rayonKm: 20, latitude: 13.51, longitude: 2.11 }]),
  listerQuartiers: vi.fn<() => Promise<object[]>>().mockResolvedValue([{ id: 5, nom: 'Plateau', villeId: 1, commune: null, latitude: null, longitude: null }]),
  listerUniversites: vi.fn<() => Promise<object[]>>().mockResolvedValue([{ id: 2, nom: 'Université Abdou Moumouni', sigle: 'UAM', villeId: 1, quartierId: null, adresse: null, latitude: null, longitude: null }]),
}))
vi.mock('@/modules/profils', () => ({ CarteProfilPublic: { template: '<div class="profil-public"><slot name="badge" user-id="u9" /></div>' } }))
vi.mock('@/modules/identite', () => ({
  BadgeIdentite: { template: '<span class="badge-identite" />' },
  BandeauIdentite: { template: '<div class="bandeau-identite" />' },
}))
vi.mock('@/modules/securite', () => ({
  EnvoiPhoto: { template: '<div class="envoi-photo" />' },
  controlerTexte: vi.fn<() => Promise<string>>(),
  messageErreurContenu: () => '',
}))

import { parametres } from '@/core/parametres'
import { formaterPrecision, messageGeolocalisation, precisionSuffisante, SEUIL_PRECISION_METRES } from '../geolocalisation'
import { routesAnnonces } from '../routes'
import { formulaireVide, type AnnonceDetail, type AnnonceResume } from '../types'
import { formaterMontant, lireEntier, validerEtapeColocataire, validerEtapeLogement, validerEtapeRegles } from '../validation'
import DetailAnnonceView from '../views/DetailAnnonceView.vue'
import EditerAnnonceView from '../views/EditerAnnonceView.vue'
import MesAnnoncesView from '../views/MesAnnoncesView.vue'

const global = { stubs: { RouterLink: { template: '<a><slot /></a>' }, CarteBase: true, SelecteurPositionAnnonce: true, PhotosAnnonce: true, ListeReglesTaches: true } }

describe('contrôles du formulaire (RG16, RG28, RG33)', () => {
  const colocation = () => ({ ...formulaireVide('place_colocation'), titre: 'Place calme près du campus', description: 'Une place dans une colocation calme et propre.', partMensuelle: '30000', loyerTotal: '90000', nbPlaces: '3', quartierId: '5' })

  it('lit un entier saisi avec ou sans espaces', () => {
    expect(lireEntier('45 000')).toBe(45000)
    expect(lireEntier('')).toBeNull()
    expect(lireEntier('12,5')).toBeNull()
    expect(lireEntier('abc')).toBeNull()
  })

  it('accepte une colocation complète', () => {
    expect(validerEtapeLogement(colocation())).toEqual({})
  })

  it('refuse un loyer nul, un loyer total trop bas et une colocation sans loyer total', () => {
    expect(validerEtapeLogement({ ...colocation(), partMensuelle: '0' })).toHaveProperty('partMensuelle')
    expect(validerEtapeLogement({ ...colocation(), loyerTotal: '20000' })).toHaveProperty('loyerTotal')
    expect(validerEtapeLogement({ ...colocation(), loyerTotal: '' })).toHaveProperty('loyerTotal')
    expect(validerEtapeLogement({ ...colocation(), nbPlaces: '1' })).toHaveProperty('nbPlaces')
  })

  it('demande un quartier, un titre et une description assez longs', () => {
    const e = validerEtapeLogement({ ...colocation(), quartierId: '', titre: 'Abc', description: 'Trop court' })
    expect(e).toHaveProperty('quartierId')
    expect(e).toHaveProperty('titre')
    expect(e).toHaveProperty('description')
  })

  it('un logement entier n\'exige ni loyer total ni places', () => {
    const studio = { ...colocation(), type: 'studio' as const, loyerTotal: '', nbPlaces: '1' }
    expect(validerEtapeLogement(studio)).toEqual({})
  })

  it('contrôle les âges (16 à 99, minimum ≤ maximum) et les durées', () => {
    const f = colocation()
    expect(validerEtapeColocataire({ ...f, ageMin: '10' })).toHaveProperty('ageMin')
    expect(validerEtapeColocataire({ ...f, ageMax: '120' })).toHaveProperty('ageMax')
    expect(validerEtapeColocataire({ ...f, ageMin: '30', ageMax: '20' })).toHaveProperty('ageMax')
    expect(validerEtapeColocataire({ ...f, ageMin: '18', ageMax: '30' })).toEqual({})
    expect(validerEtapeColocataire({ ...f, dureeMin: '12', dureeMax: '6' })).toHaveProperty('dureeMax')
    expect(validerEtapeColocataire({ ...f, dureeMin: '6', dureeMax: '12' })).toEqual({})
  })

  it('limite les règles (10, 120 caractères) et les tâches (15)', () => {
    const regles = Array.from({ length: 11 }, (_, i) => ({ texte: `Règle ${i}` }))
    expect(validerEtapeRegles(regles, [])).toHaveProperty('regles')
    expect(validerEtapeRegles([{ texte: 'x'.repeat(121) }], [])).toHaveProperty('regles')
    const taches = Array.from({ length: 16 }, (_, i) => ({ libelle: `Tâche ${i}`, frequence: 'hebdomadaire' as const, repartition: 'fixe' as const }))
    expect(validerEtapeRegles([], taches)).toHaveProperty('taches')
    expect(validerEtapeRegles([{ texte: 'Pas de bruit' }, { texte: '  ' }], [])).toEqual({})
  })

  it('met les montants en forme', () => {
    expect(formaterMontant(45000)).toBe('45 000')
  })
})

describe('« Localiser ma maison » (RG21)', () => {
  it('explique chaque cause d\'échec et propose de placer le repère à la main', () => {
    expect(messageGeolocalisation(1)).toMatch(/refusé/)
    expect(messageGeolocalisation(2)).toMatch(/signal/)
    expect(messageGeolocalisation(3)).toMatch(/15 secondes/)
    for (const code of [0, 1, 2, 3]) expect(messageGeolocalisation(code)).toMatch(/carte/)
  })

  it('invite à ajuster le repère au-delà de 50 m', () => {
    expect(SEUIL_PRECISION_METRES).toBe(50)
    expect(precisionSuffisante(12)).toBe(true)
    expect(precisionSuffisante(50)).toBe(true)
    expect(precisionSuffisante(51)).toBe(false)
    expect(formaterPrecision(12.4)).toBe('12 m')
  })
})

describe('routes (RG24)', () => {
  it('le détail est public ; les écrans d\'auteur exigent une connexion et un rôle', () => {
    const detail = routesAnnonces.find((r) => r.name === 'annonce-detail')!
    expect(detail.meta?.connexionRequise).toBeUndefined()
    expect(detail.meta?.roles).toBeUndefined()
    for (const nom of ['annonces-mes', 'annonces-nouvelle', 'annonces-editer']) {
      const r = routesAnnonces.find((x) => x.name === nom)!
      expect(r.meta?.connexionRequise).toBe(true)
      expect(r.meta?.roles).toEqual(['etudiant', 'proprietaire'])
    }
  })
})

function resume(statut: AnnonceResume['statut'], extra: Partial<AnnonceResume> = {}): AnnonceResume {
  return { id: 3, titre: 'Studio calme', type: 'studio', statut, motifRefus: null, enRevue: false, partMensuelle: 50000, quartierId: 5, misAJourLe: '2026-10-01', ...extra }
}

describe('Mes annonces', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    for (const f of Object.values(mocks.service)) f.mockReset()
  })

  it('un brouillon se soumet, se modifie, s\'archive et se supprime', async () => {
    mocks.service.listerMesAnnonces.mockResolvedValue([resume('brouillon')])
    const w = mount(MesAnnoncesView, { global })
    await flushPromises()
    const textes = w.findAll('button').map((b) => b.text())
    expect(textes).toEqual(expect.arrayContaining(['Soumettre', 'Archiver', 'Supprimer']))
    expect(w.text()).toContain('Brouillon')
  })

  it('une annonce publiée ne se supprime pas et ne se resoumet pas ; elle s\'archive', async () => {
    mocks.service.listerMesAnnonces.mockResolvedValue([resume('publiee')])
    const w = mount(MesAnnoncesView, { global })
    await flushPromises()
    const textes = w.findAll('button').map((b) => b.text())
    expect(textes).toContain('Archiver')
    expect(textes).not.toContain('Soumettre')
    expect(textes).not.toContain('Supprimer')
  })

  it('une annonce refusée montre le motif et peut être soumise de nouveau (RGA11)', async () => {
    mocks.service.listerMesAnnonces.mockResolvedValue([resume('refusee', { motifRefus: 'Photos floues' })])
    const w = mount(MesAnnoncesView, { global })
    await flushPromises()
    expect(w.text()).toContain('Photos floues')
    expect(w.findAll('button').map((b) => b.text())).toContain('Soumettre')
  })

  it('une annonce archivée peut être rouverte', async () => {
    mocks.service.listerMesAnnonces.mockResolvedValue([resume('archivee')])
    mocks.service.rouvrirAnnonce.mockResolvedValue(undefined)
    const w = mount(MesAnnoncesView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Rouvrir')!.trigger('click')
    await flushPromises()
    expect(mocks.service.rouvrirAnnonce).toHaveBeenCalledWith(3)
  })

  it('soumettre appelle la base ; l\'erreur de la base s\'affiche (ex. identité à vérifier)', async () => {
    mocks.service.listerMesAnnonces.mockResolvedValue([resume('brouillon')])
    mocks.service.soumettreAnnonce.mockRejectedValue(new Error('Vérifie ton identité avant de continuer.'))
    const w = mount(MesAnnoncesView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Soumettre')!.trigger('click')
    await flushPromises()
    expect(mocks.service.soumettreAnnonce).toHaveBeenCalledWith(3)
    expect(w.text()).toContain('Vérifie ton identité')
  })

  it('signale une annonce masquée en attendant la revue d\'un mot sensible (RG45)', async () => {
    mocks.service.listerMesAnnonces.mockResolvedValue([resume('publiee', { enRevue: true })])
    const w = mount(MesAnnoncesView, { global })
    await flushPromises()
    expect(w.text()).toContain('masquée')
  })
})

function detail(extra: Partial<AnnonceDetail> = {}): AnnonceDetail {
  return {
    id: 7, auteurId: 'u9', titre: 'Chambre près du campus', description: 'Une chambre calme.', type: 'place_colocation', statut: 'publiee',
    motifRefus: null, nbPlaces: 3, partMensuelle: 30000, loyerTotal: 90000, chargesIncluses: true, montantCharges: null, quartierId: 5,
    universiteId: 2, disponibleLe: null, dureeMin: null, dureeMax: null, contactWhatsapp: true, contactAppel: false, preferenceGenre: 'indifferent',
    ageMin: null, ageMax: null, etudiantsUniquement: false, precision: 'approximative', latitude: 13.51, longitude: 2.11, zoneRayonM: 150,
    distanceUniversiteM: 1200, equipements: ['Climatisation'], regles: ['Pas de bruit après 22 h'], taches: [{ libelle: 'Vaisselle', frequence: 'quotidienne', repartition: 'tour_de_role' }],
    photos: [], ...extra,
  }
}

describe('Détail d\'une annonce', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    for (const f of Object.values(mocks.service)) f.mockReset()
    mocks.route.params = { id: '7' }
    mocks.connecte.value = true
  })

  it('affiche le prix par personne, le loyer total, les règles, les tâches et l\'avertissement de paiement', async () => {
    mocks.service.lireAnnonceDetail.mockResolvedValue(detail())
    const w = mount(DetailAnnonceView, { global })
    await flushPromises()
    expect(w.text()).toContain('30 000 FCFA')
    expect(w.text()).toContain('par mois et par colocataire')
    expect(w.text()).toContain('Loyer total 90 000 FCFA pour 3 places')
    expect(w.text()).toContain('Pas de bruit après 22 h')
    expect(w.text()).toContain('Vaisselle')
    expect(w.text()).toContain('Climatisation')
    expect(w.text()).toContain('Ne payez jamais avant d\'avoir visité le logement')
    expect(w.text()).toContain('près de UAM (1,2 km)')
    expect(w.find('.badge-identite').exists()).toBe(true)
  })

  it('une zone approximative est annoncée comme telle (RG23)', async () => {
    mocks.service.lireAnnonceDetail.mockResolvedValue(detail())
    const w = mount(DetailAnnonceView, { global })
    await flushPromises()
    expect(w.text()).toContain('Zone approximative')
  })

  it('un visiteur n\'a pas de bouton de contact : il est invité à se connecter (RG32)', async () => {
    mocks.connecte.value = false
    mocks.service.lireAnnonceDetail.mockResolvedValue(detail())
    const w = mount(DetailAnnonceView, { global })
    await flushPromises()
    expect(w.text()).toContain('Connecte-toi')
    expect(w.findAll('button').map((b) => b.text())).not.toContain('Écrire sur WhatsApp')
    expect(mocks.service.lireContactAnnonce).not.toHaveBeenCalled()
  })

  it('ne propose que les moyens de contact autorisés, et ne demande le numéro qu\'au clic', async () => {
    mocks.service.lireAnnonceDetail.mockResolvedValue(detail({ contactAppel: false, contactWhatsapp: true }))
    mocks.service.lireContactAnnonce.mockResolvedValue({ telephone: null, whatsapp: '22790112233' })
    const ouvrir = vi.spyOn(window, 'open').mockReturnValue(null)
    const w = mount(DetailAnnonceView, { global })
    await flushPromises()
    const boutons = w.findAll('button').map((b) => b.text())
    expect(boutons).toContain('Écrire sur WhatsApp')
    expect(boutons).not.toContain('Appeler')
    expect(mocks.service.lireContactAnnonce).not.toHaveBeenCalled()
    await w.findAll('button').find((b) => b.text() === 'Écrire sur WhatsApp')!.trigger('click')
    await flushPromises()
    expect(mocks.service.lireContactAnnonce).toHaveBeenCalledWith(7)
    expect(ouvrir).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/22790112233?text='), '_blank', 'noopener')
    ouvrir.mockRestore()
  })

  it('montre le message de la base quand la limite quotidienne de contacts est atteinte (RGP20)', async () => {
    mocks.service.lireAnnonceDetail.mockResolvedValue(detail())
    mocks.service.lireContactAnnonce.mockRejectedValue(new Error('Tu fais trop de demandes. Réessaie dans un moment.'))
    const w = mount(DetailAnnonceView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Écrire sur WhatsApp')!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('trop de demandes')
  })

  it('une annonce non publiée est un aperçu pour son auteur, avec le motif de refus, sans bouton de contact', async () => {
    mocks.service.lireAnnonceDetail.mockResolvedValue(detail({ statut: 'refusee', motifRefus: 'Photos floues' }))
    const w = mount(DetailAnnonceView, { global })
    await flushPromises()
    expect(w.text()).toContain('Aperçu visible par toi seulement')
    expect(w.text()).toContain('Photos floues')
    expect(w.text()).not.toContain('Contacter l\'annonceur')
  })

  it('une annonce introuvable ou invisible affiche un message neutre', async () => {
    mocks.service.lireAnnonceDetail.mockResolvedValue(null)
    const w = mount(DetailAnnonceView, { global })
    await flushPromises()
    expect(w.text()).toContain('n\'est plus disponible')
  })
})

describe('Éditeur en étapes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    for (const f of Object.values(mocks.service)) f.mockReset()
    mocks.service.listerEquipements.mockResolvedValue([])
    mocks.route.params = {}
    mocks.route.query = {}
    mocks.router.replace.mockReset()
    parametres.value.photos_max = 5
  })

  it('un étudiant ne peut publier qu\'une place en colocation (RG13)', async () => {
    mocks.role.value = 'etudiant'
    const w = mount(EditerAnnonceView, { global })
    await flushPromises()
    expect(w.text()).toContain('Tu publies une place en colocation')
    expect(w.text()).toContain('Loyer total du logement')
    expect(w.text()).toContain('Nombre de places')
  })

  it('un propriétaire choisit chambre, studio ou appartement, sans place en colocation', async () => {
    mocks.role.value = 'proprietaire'
    const w = mount(EditerAnnonceView, { global })
    await flushPromises()
    const options = w.findAll('select')[0]!.findAll('option').map((o) => o.text())
    expect(options).toEqual(['Chambre', 'Studio', 'Appartement'])
    expect(w.text()).not.toContain('Loyer total du logement')
  })

  it('l\'étape 1 refuse un formulaire incomplet sans rien enregistrer', async () => {
    mocks.role.value = 'proprietaire'
    const w = mount(EditerAnnonceView, { global })
    await flushPromises()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Le titre doit avoir au moins 5 caractères')
    expect(w.text()).toContain('Choisis le quartier')
    expect(mocks.service.creerAnnonce).not.toHaveBeenCalled()
  })

  it('l\'étape 1 valide crée le brouillon puis passe à l\'étape suivante', async () => {
    mocks.role.value = 'proprietaire'
    mocks.service.creerAnnonce.mockResolvedValue(11)
    const w = mount(EditerAnnonceView, { global })
    await flushPromises()
    await w.find('input').setValue('Studio près du campus')
    await w.find('textarea').setValue('Un studio calme et lumineux près du campus.')
    const champs = w.findAll('input[inputmode="numeric"]')
    await champs[0]!.setValue('50000')
    await w.findAll('select')[1]!.setValue('5')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.service.creerAnnonce).toHaveBeenCalledTimes(1)
    expect(mocks.router.replace).toHaveBeenCalledWith({ name: 'annonces-editer', params: { id: '11' }, query: { etape: '1' } })
  })

  it('une annonce refusée montre le motif en haut du formulaire', async () => {
    mocks.role.value = 'proprietaire'
    mocks.route.params = { id: '11' }
    mocks.service.lireAnnoncePourEdition.mockResolvedValue({
      formulaire: { ...formulaireVide('studio'), titre: 'Studio près du campus', description: 'Un studio calme et lumineux.', partMensuelle: '50000', quartierId: '5' },
      statut: 'refusee', motifRefus: 'Photos floues', enRevue: false,
    })
    const w = mount(EditerAnnonceView, { global })
    await flushPromises()
    expect(w.text()).toContain('Photos floues')
  })

  it('l\'étape localisation refuse de continuer sans repère confirmé (RG21)', async () => {
    mocks.role.value = 'proprietaire'
    mocks.route.params = { id: '11' }
    mocks.route.query = { etape: '2' }
    mocks.service.lireAnnoncePourEdition.mockResolvedValue({
      formulaire: { ...formulaireVide('studio'), titre: 'Studio près du campus', description: 'Un studio calme et lumineux.', partMensuelle: '50000', quartierId: '5' },
      statut: 'brouillon', motifRefus: null, enRevue: false,
    })
    const w = mount(EditerAnnonceView, { global })
    await flushPromises()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Place ton logement sur la carte')
    expect(mocks.service.modifierAnnonce).not.toHaveBeenCalled()
  })

  it('à la dernière étape, le bouton Soumettre appelle la base', async () => {
    mocks.role.value = 'proprietaire'
    mocks.route.params = { id: '11' }
    mocks.route.query = { etape: '5' }
    mocks.service.lireAnnoncePourEdition.mockResolvedValue({
      formulaire: { ...formulaireVide('studio'), titre: 'Studio près du campus', description: 'Un studio calme et lumineux.', partMensuelle: '50000', quartierId: '5' },
      statut: 'brouillon', motifRefus: null, enRevue: false,
    })
    mocks.service.soumettreAnnonce.mockResolvedValue('en_attente')
    const w = mount(EditerAnnonceView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text().includes('Soumettre'))!.trigger('click')
    await flushPromises()
    expect(mocks.service.soumettreAnnonce).toHaveBeenCalledWith(11)
    expect(mocks.router.push).toHaveBeenCalledWith({ name: 'annonces-mes' })
  })
})
