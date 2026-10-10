// M5 : filtres et lien dans l'URL, regroupement des marqueurs, favoris, pages de résultats.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
  insert: vi.fn<(valeurs: unknown) => Promise<{ error: unknown }>>(),
  supprimer: vi.fn<() => Promise<{ error: unknown }>>(),
  route: { query: {} as Record<string, unknown>, fullPath: '/recherche' },
  router: { push: vi.fn<(d: unknown) => void>(), replace: vi.fn<(d: unknown) => void>() },
  connecte: { value: true },
}))

vi.mock('@/core/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({
      select: () => Promise.resolve({ data: [{ annonce_id: 5 }], error: null }),
      insert: mocks.insert,
      delete: () => ({ eq: mocks.supprimer }),
    }),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://x/p.webp' } }) }) },
  },
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}))
vi.mock('@/modules/auth', () => ({ useAuthStore: () => ({ estConnecte: mocks.connecte.value }) }))
vi.mock('@/modules/securite', () => ({ messageErreurContenu: (e: { message?: string } | null) => e?.message ?? 'Erreur' }))
vi.mock('@/modules/annonces', () => ({ listerEquipements: vi.fn<() => Promise<object[]>>().mockResolvedValue([{ id: 1, nom: 'Climatisation' }]) }))
vi.mock('@/modules/referentiel', () => ({
  listerVilles: vi.fn<() => Promise<object[]>>().mockResolvedValue([{ id: 1, nom: 'Niamey', rayonKm: 20, latitude: 13.51, longitude: 2.11 }]),
  listerQuartiers: vi.fn<() => Promise<object[]>>().mockResolvedValue([{ id: 5, nom: 'Plateau', villeId: 1, commune: null, latitude: null, longitude: null }]),
  listerUniversites: vi.fn<() => Promise<object[]>>().mockResolvedValue([
    { id: 2, nom: 'Université A', sigle: 'UA', villeId: 1, quartierId: null, adresse: null, latitude: 13.5, longitude: 2.1 },
    { id: 3, nom: 'Université B', sigle: null, villeId: 1, quartierId: null, adresse: null, latitude: null, longitude: null },
  ]),
  aUnePosition: (u: { latitude: number | null; longitude: number | null }) => u.latitude !== null && u.longitude !== null,
}))

import { compterFiltres, depuisRequeteUrl, filtresVides, formaterDistance, regrouper, versFiltresBase, versRequeteUrl } from '../types'
import { useFavorisStore } from '../stores/favorisStore'
import FiltresPanneau from '../components/FiltresPanneau.vue'
import BoutonFavori from '../components/BoutonFavori.vue'
import MesFavorisView from '../views/MesFavorisView.vue'
import ResultatsView from '../views/ResultatsView.vue'
import { routesRecherche } from '../routes'

const global = { stubs: { RouterLink: { template: '<a><slot /></a>' }, CarteBase: true, CarteResultats: true, ApercuCarte: true } }

function ligne(id: number, extra: Record<string, unknown> = {}) {
  return {
    id, type: 'chambre', titre: `Annonce ${id}`, part_mensuelle_fcfa: 40000, loyer_total_fcfa: null, nb_places: 1, quartier_id: 5,
    universite_proche_id: null, disponible_le: null, photo_chemin: null, latitude: 13.5, longitude: 2.1, zone_rayon_m: 150,
    distance_universite_m: null, distance_ref_m: null, publiee_le: '2026-10-01', curseur_valeur: '2026-10-01', ...extra,
  }
}

describe('filtres', () => {
  it('ne garde dans la requête que les filtres renseignés', () => {
    expect(versFiltresBase(filtresVides())).toEqual({})
    const f = { ...filtresVides(), texte: '  balcon ', quartierId: '5', type: 'studio' as const, loyerMin: '20 000', loyerMax: '60000', equipements: [1, 2], compatible: true }
    expect(versFiltresBase(f, 1)).toEqual({ ville_id: 1, texte: 'balcon', quartier_id: 5, type: 'studio', loyer_min: 20000, loyer_max: 60000, equipements: [1, 2], compatible: true })
  })

  it('ignore les valeurs invalides au lieu d\'échouer', () => {
    const f = { ...filtresVides(), loyerMin: 'abc', disponibleAvant: 'demain', dureeMois: '-3' }
    expect(versFiltresBase(f)).toEqual({})
  })

  it('compte les filtres actifs sans le tri ni le texte', () => {
    expect(compterFiltres(filtresVides())).toBe(0)
    expect(compterFiltres({ ...filtresVides(), quartierId: '5', loyerMax: '60000', equipements: [1], tri: 'loyer_asc', texte: 'x' })).toBe(3)
  })
})

describe('filtres dans l\'URL', () => {
  it('fait l\'aller-retour sans perte', () => {
    const f = { ...filtresVides(), texte: 'balcon', quartierId: '5', universiteId: '2', universiteRefId: '2', type: 'studio' as const, loyerMin: '20000', loyerMax: '60000', disponibleAvant: '2026-12-01', equipements: [1, 3], dureeMois: '6', compatible: true, tri: 'loyer_desc' as const }
    const q = versRequeteUrl(f, 'carte')
    expect(depuisRequeteUrl(q)).toEqual({ filtres: f, vue: 'carte' })
  })

  it('une URL vide donne la liste sans filtre', () => {
    expect(depuisRequeteUrl({})).toEqual({ filtres: filtresVides(), vue: 'liste' })
  })

  it('refuse les valeurs piégées d\'un lien modifié à la main', () => {
    const { filtres, vue } = depuisRequeteUrl({ type: 'villa', quartier: '5; drop', min: '-1', dispo: 'x', equipements: '1,a,3', tri: 'hasard', vue: 'autre', texte: ['a', 'b'] })
    expect(filtres.type).toBe('')
    expect(filtres.quartierId).toBe('')
    expect(filtres.loyerMin).toBe('')
    expect(filtres.disponibleAvant).toBe('')
    expect(filtres.equipements).toEqual([1, 3])
    expect(filtres.tri).toBe('recent')
    expect(filtres.texte).toBe('a')
    expect(vue).toBe('liste')
  })
})

describe('regroupement des marqueurs sur la carte', () => {
  const points = [
    { id: 1, latitude: 13.5, longitude: 2.1 },
    { id: 2, latitude: 13.5001, longitude: 2.1001 },
    { id: 3, latitude: 13.6, longitude: 2.2 },
  ]
  it('regroupe les points proches quand la carte est dézoomée', () => {
    const g = regrouper(points, 10)
    expect(g).toHaveLength(2)
    expect(g.find((x) => x.points.length === 2)?.points.map((p) => p.id).sort()).toEqual([1, 2])
  })
  it('au zoom maximum, chaque annonce a son marqueur', () => {
    expect(regrouper(points, 18)).toHaveLength(3)
  })
  it('met le centre du groupe à la moyenne des points', () => {
    const g = regrouper(points.slice(0, 2), 10)[0]!
    expect(g.latitude).toBeCloseTo(13.50005, 5)
  })
  it('met en forme les distances', () => {
    expect(formaterDistance(850)).toBe('850 m')
    expect(formaterDistance(1500)).toBe('1,5 km')
  })
})

describe('routes (RG24)', () => {
  it('la recherche est publique, les favoris exigent une connexion', () => {
    expect(routesRecherche.find((r) => r.name === 'recherche')!.meta?.connexionRequise).toBeUndefined()
    expect(routesRecherche.find((r) => r.name === 'favoris')!.meta?.connexionRequise).toBe(true)
  })
})

describe('favoris', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.rpc.mockReset()
    mocks.insert.mockReset()
    mocks.supprimer.mockReset()
    mocks.router.push.mockReset()
    mocks.connecte.value = true
  })

  it('bascule tout de suite, puis écrit en base', async () => {
    mocks.insert.mockResolvedValue({ error: null })
    const store = useFavorisStore()
    expect(await store.basculer(7)).toBeNull()
    expect(store.estFavori(7)).toBe(true)
    expect(mocks.insert).toHaveBeenCalledWith({ annonce_id: 7 })
    mocks.supprimer.mockResolvedValue({ error: null })
    expect(await store.basculer(7)).toBeNull()
    expect(store.estFavori(7)).toBe(false)
  })

  it('revient en arrière si la base refuse', async () => {
    mocks.insert.mockResolvedValue({ error: { code: 'P0001', message: 'Tu as atteint le maximum de 200 favoris.' } })
    const store = useFavorisStore()
    expect(await store.basculer(7)).toContain('200 favoris')
    expect(store.estFavori(7)).toBe(false)
  })

  it('un visiteur est invité à se connecter au lieu d\'écrire', async () => {
    mocks.connecte.value = false
    const w = mount(BoutonFavori, { props: { annonceId: 7 } })
    await w.find('button').trigger('click')
    await flushPromises()
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.router.push).toHaveBeenCalledWith({ path: '/connexion', query: { redirect: '/recherche' } })
  })

  it('Mes favoris ne montre que les annonces encore publiées renvoyées par la base', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...ligne(5), auteur_id: 'u1' }], error: null })
    const w = mount(MesFavorisView, { global })
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('mes_favoris')
    expect(w.text()).toContain('Plateau')
  })

  it('Mes favoris sans annonce affiche un état vide utile', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    const w = mount(MesFavorisView, { global })
    await flushPromises()
    expect(w.text()).toContain('pas encore de favori')
    expect(w.text()).toContain('Chercher un logement')
  })
})

describe('page de résultats', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.rpc.mockReset()
    mocks.router.replace.mockReset()
    mocks.route.query = {}
  })

  it('lance la recherche avec les filtres de l\'URL et affiche les cartes', async () => {
    mocks.route.query = { quartier: '5', type: 'chambre', max: '50000', tri: 'loyer_asc' }
    mocks.rpc.mockResolvedValue({ data: [ligne(1), ligne(2)], error: null })
    const w = mount(ResultatsView, { global })
    await flushPromises()
    const appel = mocks.rpc.mock.calls.find((c) => c[0] === 'rechercher_annonces')!
    expect(appel[1]).toMatchObject({ p_filtres: { ville_id: 1, quartier_id: 5, type: 'chambre', loyer_max: 50000 }, p_tri: 'loyer_asc', p_limite: 20 })
    expect(w.findAll('li')).toHaveLength(2)
  })

  it('un état vide propose d\'effacer les filtres', async () => {
    mocks.route.query = { type: 'studio' }
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    const w = mount(ResultatsView, { global })
    await flushPromises()
    expect(w.text()).toContain('Aucune annonce ne correspond')
    expect(w.text()).toContain('Effacer les filtres')
  })

  it('propose « Voir plus » quand une page est pleine et envoie le curseur', async () => {
    const page = Array.from({ length: 20 }, (_, i) => ligne(100 - i, { curseur_valeur: `c${i}` }))
    mocks.rpc.mockResolvedValue({ data: page, error: null })
    const w = mount(ResultatsView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text().includes('Voir plus'))!.trigger('click')
    await flushPromises()
    const derniers = mocks.rpc.mock.calls.filter((c) => c[0] === 'rechercher_annonces')
    expect(derniers[1]![1]).toMatchObject({ p_curseur: { v: 'c19', id: 81 } })
  })

  it('met les filtres dans l\'URL à la recherche', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    const w = mount(ResultatsView, { global })
    await flushPromises()
    await w.find('input[type="search"]').setValue('balcon')
    await w.find('form[role="search"]').trigger('submit')
    expect(mocks.router.replace).toHaveBeenCalledWith({ query: { texte: 'balcon' } })
  })

  it('bascule vers la carte en gardant les filtres', async () => {
    mocks.route.query = { type: 'studio' }
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    const w = mount(ResultatsView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Carte')!.trigger('click')
    expect(mocks.router.replace).toHaveBeenCalledWith({ query: { type: 'studio', vue: 'carte' } })
  })

  it('affiche un message clair si la recherche échoue', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '500', message: 'boom' } })
    const w = mount(ResultatsView, { global })
    await flushPromises()
    expect(w.text()).toContain('La recherche a échoué')
    expect(w.text()).not.toContain('boom')
  })
})

describe('panneau de filtres (RG25 bis)', () => {
  it('grise une université sans position et le dit', () => {
    const w = mount(FiltresPanneau, {
      props: {
        modelValue: filtresVides(),
        quartiers: [],
        equipements: [],
        universites: [
          { id: 2, nom: 'Université A', avecPosition: true },
          { id: 3, nom: 'Université B', avecPosition: false },
        ],
      },
    })
    const options = w.find('#universite-ref').findAll('option')
    const b = options.find((o) => o.text().includes('Université B'))!
    expect(b.attributes('disabled')).toBeDefined()
    expect(b.text()).toContain('position pas encore renseignée')
    expect(options.find((o) => o.text() === 'Université A')!.attributes('disabled')).toBeUndefined()
  })
})
