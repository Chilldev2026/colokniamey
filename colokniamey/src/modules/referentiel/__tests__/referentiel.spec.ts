import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// Faux client Supabase : on contrôle ce que renvoient les vues
const resultat = vi.hoisted(() => ({ data: [] as unknown[], error: null as { message: string } | null }))
const filtres = vi.hoisted(() => ({ eq: vi.fn<(colonne: string, valeur: unknown) => void>() }))

vi.mock('@/core/supabase', () => {
  const requete = {
    select: () => requete,
    eq: (colonne: string, valeur: unknown) => {
      filtres.eq(colonne, valeur)
      return requete
    },
    order: () => Promise.resolve({ data: resultat.data, error: resultat.error }),
  }
  return { supabase: { from: () => requete } }
})

import { aUnePosition, listerQuartiers, listerUniversites, listerVilles, SelecteurUniversite } from '../index'

const ligneUniv = (id: number, nom: string, latitude: number | null, longitude: number | null) => ({
  id,
  nom,
  sigle: null,
  ville_id: 1,
  quartier_id: null,
  adresse: null,
  latitude,
  longitude,
})

beforeEach(() => {
  resultat.data = []
  resultat.error = null
  filtres.eq.mockClear()
})

describe('listerUniversites (RG25 bis)', () => {
  it('liste aussi une université sans position', async () => {
    resultat.data = [ligneUniv(1, 'UAM', 13.5, 2.09), ligneUniv(2, 'UPEN', null, null)]
    const liste = await listerUniversites()
    expect(liste.map((u) => u.nom)).toEqual(['UAM', 'UPEN'])
    expect(aUnePosition(liste[0]!)).toBe(true)
    expect(aUnePosition(liste[1]!)).toBe(false)
  })

  it('filtre par ville quand on en donne une', async () => {
    await listerUniversites(7)
    expect(filtres.eq).toHaveBeenCalledWith('ville_id', 7)
  })

  it('ne filtre pas sans ville', async () => {
    await listerUniversites()
    expect(filtres.eq).not.toHaveBeenCalled()
  })

  it('écarte une ligne incomplète et signale une erreur en français', async () => {
    resultat.data = [{ ...ligneUniv(1, 'UAM', null, null), nom: null }]
    expect(await listerUniversites()).toEqual([])
    resultat.error = { message: 'secret technique' }
    await expect(listerUniversites()).rejects.toThrow('Impossible de charger les universités.')
  })
})

describe('villes et quartiers', () => {
  it('convertit les villes', async () => {
    resultat.data = [{ id: 1, nom: 'Niamey', rayon_km: 20, latitude: 13.51, longitude: 2.11 }]
    expect(await listerVilles()).toEqual([{ id: 1, nom: 'Niamey', rayonKm: 20, latitude: 13.51, longitude: 2.11 }])
  })

  it('filtre les quartiers par ville', async () => {
    resultat.data = [{ id: 5, nom: 'Bobiel', ville_id: 1, commune: 'Niamey I', latitude: null, longitude: null }]
    const quartiers = await listerQuartiers(1)
    expect(filtres.eq).toHaveBeenCalledWith('ville_id', 1)
    expect(quartiers[0]).toMatchObject({ nom: 'Bobiel', commune: 'Niamey I', latitude: null })
  })
})

describe('SelecteurUniversite', () => {
  it('propose les universités, avec ou sans position', async () => {
    resultat.data = [ligneUniv(1, 'Université Abdou Moumouni', 13.5, 2.09), ligneUniv(2, 'UPEN', null, null)]
    const composant = mount(SelecteurUniversite, { props: { modelValue: '' } })
    await flushPromises()
    const options = composant.findAll('option').map((o) => o.text())
    expect(options).toContain('Université Abdou Moumouni')
    expect(options).toContain('UPEN')
  })

  it('affiche une erreur claire si le chargement échoue', async () => {
    resultat.error = { message: 'x' }
    const composant = mount(SelecteurUniversite, { props: { modelValue: '' } })
    await flushPromises()
    expect(composant.text()).toContain('Impossible de charger les universités.')
  })
})
