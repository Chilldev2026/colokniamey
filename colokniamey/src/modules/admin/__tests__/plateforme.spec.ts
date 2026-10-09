// A5 : paramètres typés, géographie du référentiel, diffusion temps réel de la maintenance, écrans en lecture seule.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
}))

vi.mock('@/core/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => undefined,
  },
}))

import { definirRoleCourant } from '@/core/acces'
import { appliquerParametreRecu } from '@/core/plateforme'
import { maintenanceBloquante, parametres } from '@/core/parametres'
import { afficherValeur, GROUPES_PARAMETRES, lireValeur } from '../plateforme/parametres'
import { distanceMetres, dansLaZone, lireCoordonnees, versEwkt } from '../referentiel/geo'
import ParametresView from '../plateforme/views/ParametresView.vue'
import MaintenanceView from '../plateforme/views/MaintenanceView.vue'

const tousLesParametres = GROUPES_PARAMETRES.flatMap((g) => g.parametres)
const def = (cle: string) => tousLesParametres.find((p) => p.cle === cle)!

describe('lecture typée des paramètres (RGA17)', () => {
  it('refuse photos_max hors de 1 à 10', () => {
    expect(lireValeur(def('photos_max'), '0')).toHaveProperty('erreur')
    expect(lireValeur(def('photos_max'), '11')).toHaveProperty('erreur')
    expect(lireValeur(def('photos_max'), '2.5')).toHaveProperty('erreur')
    expect(lireValeur(def('photos_max'), 'cinq')).toHaveProperty('erreur')
    expect(lireValeur(def('photos_max'), '10')).toEqual({ valeur: 10 })
  })

  it('accepte une virgule décimale pour le seuil', () => {
    expect(lireValeur(def('nsfw_seuil'), '0,7')).toEqual({ valeur: 0.7 })
    expect(lireValeur(def('nsfw_seuil'), '0,1')).toHaveProperty('erreur')
  })

  it('lit les booléens et refuse un texte vide', () => {
    expect(lireValeur(def('kyc_actif'), true)).toEqual({ valeur: true })
    expect(lireValeur(def('kyc_actif'), false)).toEqual({ valeur: false })
    expect(lireValeur(def('version_cgu'), '  ')).toHaveProperty('erreur')
    expect(lireValeur(def('version_cgu'), '2.0')).toEqual({ valeur: '2.0' })
  })

  it('présente les valeurs avec leur unité', () => {
    expect(afficherValeur(def('kyc_actif'), false)).toBe('Non')
    expect(afficherValeur(def('photo_taille_max_mo'), 10)).toBe('10 Mo')
  })

  it('couvre les paramètres demandés : KYC, e-mail, récapitulatif, relances', () => {
    const cles = tousLesParametres.map((p) => p.cle)
    expect(cles).toEqual(expect.arrayContaining(['kyc_actif', 'email_domaine_verifie', 'heure_recapitulatif', 'seuil_relance_heures', 'inscriptions_ouvertes', 'photos_max']))
  })
})

describe('géographie du référentiel (RG22)', () => {
  const niamey = { latitude: 13.51361, longitude: 2.10972, rayonKm: 20 }

  it('calcule des distances plausibles', () => {
    expect(distanceMetres(niamey, niamey)).toBeCloseTo(0, 5)
    // 0,01° de latitude ≈ 1,11 km
    expect(distanceMetres(niamey, { latitude: niamey.latitude + 0.01, longitude: niamey.longitude })).toBeGreaterThan(1100)
    expect(distanceMetres(niamey, { latitude: niamey.latitude + 0.01, longitude: niamey.longitude })).toBeLessThan(1120)
  })

  it('refuse un point hors de la zone de la ville', () => {
    expect(dansLaZone({ latitude: 13.52, longitude: 2.11 }, niamey)).toBe(true)
    expect(dansLaZone({ latitude: 0, longitude: 0 }, niamey)).toBe(false)
    expect(dansLaZone({ latitude: 13.9, longitude: 2.11 }, niamey)).toBe(false) // ≈ 43 km
  })

  it('lit des coordonnées saisies à la main', () => {
    expect(lireCoordonnees('', '')).toBeNull()
    expect(lireCoordonnees('13,5', '2.1')).toEqual({ latitude: 13.5, longitude: 2.1 })
    expect(lireCoordonnees('13.5', '')).toHaveProperty('erreur')
    expect(lireCoordonnees('abc', '2')).toHaveProperty('erreur')
    expect(lireCoordonnees('95', '2')).toHaveProperty('erreur')
    expect(lireCoordonnees('13', '200')).toHaveProperty('erreur')
  })

  it('écrit les points avec la longitude d\'abord (format PostGIS)', () => {
    expect(versEwkt({ latitude: 13.5, longitude: 2.1 })).toBe('SRID=4326;POINT(2.1 13.5)')
  })
})

describe('maintenance diffusée en temps réel (RGA15)', () => {
  const route = ref({ name: 'accueil', meta: {} as Record<string, unknown> })
  const routeur = { currentRoute: route, replace: vi.fn<(destination: unknown) => Promise<void>>(() => Promise.resolve()) }

  beforeEach(() => {
    definirRoleCourant('etudiant')
    parametres.value.maintenance_active = false
    routeur.replace.mockClear()
    route.value = { name: 'accueil', meta: {} }
  })
  afterEach(() => definirRoleCourant(null))

  it('envoie un utilisateur connecté vers la page de maintenance sans recharger', async () => {
    appliquerParametreRecu({ cle: 'maintenance_active', valeur: true }, routeur as never)
    expect(parametres.value.maintenance_active).toBe(true)
    expect(routeur.replace).toHaveBeenCalledWith({ name: 'maintenance' })
    // le cache de 60 s est mis à jour : plus d'appel à la base
    expect(await maintenanceBloquante()).toBe(true)
  })

  it('ne touche pas un admin', async () => {
    definirRoleCourant('admin')
    appliquerParametreRecu({ cle: 'maintenance_active', valeur: true }, routeur as never)
    expect(routeur.replace).not.toHaveBeenCalled()
    expect(await maintenanceBloquante()).toBe(false)
  })

  it('ne touche pas les pages qui restent ouvertes en maintenance (connexion, conditions…)', () => {
    route.value = { name: 'cgu', meta: { horsMaintenance: true } }
    appliquerParametreRecu({ cle: 'maintenance_active', valeur: true }, routeur as never)
    expect(routeur.replace).not.toHaveBeenCalled()
  })

  it('ramène à l\'accueil quand la maintenance se termine', () => {
    parametres.value.maintenance_active = true
    route.value = { name: 'maintenance', meta: { horsMaintenance: true } }
    appliquerParametreRecu({ cle: 'maintenance_active', valeur: false }, routeur as never)
    expect(routeur.replace).toHaveBeenCalledWith('/')
  })

  it('met à jour le message sans changer de page, et ignore les messages inconnus ou mal formés', () => {
    appliquerParametreRecu({ cle: 'maintenance_message', valeur: 'Retour à 18 h' }, routeur as never)
    expect(parametres.value.maintenance_message).toBe('Retour à 18 h')
    appliquerParametreRecu({ cle: 'cle_inconnue', valeur: 1 }, routeur as never)
    appliquerParametreRecu('n\'importe quoi', routeur as never)
    appliquerParametreRecu(null, routeur as never)
    expect('cle_inconnue' in parametres.value).toBe(false)
    expect(routeur.replace).not.toHaveBeenCalled()
  })
})

describe('écrans Paramètres et Maintenance : lecture seule pour l\'admin (RGA26, RGA27)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.rpc.mockReset()
    mocks.rpc.mockImplementation((nom) => {
      if (nom === 'liste_parametres') {
        return Promise.resolve({
          data: tousLesParametres.map((p) => ({ cle: p.cle, valeur: p.type === 'booleen' ? false : p.type === 'texte' ? '1.0' : 5, publique: true, modifie_le: '2026-01-01' })),
          error: null,
        })
      }
      return Promise.resolve({ data: {}, error: null })
    })
  })
  afterEach(() => definirRoleCourant(null))

  it('l\'admin voit les valeurs sans aucun bouton de modification', async () => {
    definirRoleCourant('admin')
    const w = mount(ParametresView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('Les paramètres ne sont modifiables que par le super-admin')
    expect(w.text()).toContain('Non') // valeurs affichées en texte
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.findAll('input')).toHaveLength(0)
  })

  it('le super-admin a un bouton Enregistrer par paramètre, grisé tant que rien n\'a changé', async () => {
    definirRoleCourant('super_admin')
    const w = mount(ParametresView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    const boutons = w.findAll('button')
    expect(boutons).toHaveLength(tousLesParametres.length)
    expect(boutons.every((b) => b.attributes('disabled') !== undefined)).toBe(true)
  })

  it('le super-admin enregistre un paramètre par modifier_parametre', async () => {
    definirRoleCourant('super_admin')
    const w = mount(ParametresView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    await w.find('#p-photos_max').setValue('8')
    const bouton = w.findAll('.ligne').find((l) => l.text().includes('Nombre de photos par annonce'))!.find('button')
    await bouton.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('modifier_parametre', { p_cle: 'photos_max', p_valeur: 8 })
  })

  it('refuse sur l\'écran une valeur hors bornes, sans appeler la base', async () => {
    definirRoleCourant('super_admin')
    const w = mount(ParametresView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    await w.find('#p-photos_max').setValue('50')
    await w.findAll('.ligne').find((l) => l.text().includes('Nombre de photos par annonce'))!.find('button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Le maximum est 10')
    expect(mocks.rpc.mock.calls.some((c) => c[0] === 'modifier_parametre')).toBe(false)
  })

  it('l\'admin ne voit aucun formulaire de maintenance', async () => {
    definirRoleCourant('admin')
    const w = mount(MaintenanceView)
    await flushPromises()
    expect(w.text()).toContain('Seul le super-admin peut activer ou désactiver la maintenance')
    expect(w.find('textarea').exists()).toBe(false)
    expect(w.text()).not.toContain('Activer la maintenance')
  })

  it('le super-admin demande une confirmation avant d\'activer, puis appelle definir_maintenance', async () => {
    definirRoleCourant('super_admin')
    const w = mount(MaintenanceView, { attachTo: document.body })
    await flushPromises()
    await w.find('textarea').setValue('Mise à jour de la base')
    await w.find('form').trigger('submit')
    await flushPromises()
    // la confirmation est dans une fenêtre (Teleport) : rien n'est encore envoyé
    expect(mocks.rpc.mock.calls.some((c) => c[0] === 'definir_maintenance')).toBe(false)
    const confirmer = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Confirmer')!
    confirmer.click()
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('definir_maintenance', { p_active: true, p_message: 'Mise à jour de la base' })
    w.unmount()
  })
})
