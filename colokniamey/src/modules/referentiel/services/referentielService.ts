// Seul endroit du module qui appelle Supabase. Lecture publique : aucune écriture ici (RG07).
// On lit les vues *_geo, qui exposent latitude et longitude (la RLS de l'appelant s'applique).

import { supabase } from '@/core/supabase'
import type { Quartier, Universite, Ville } from '../types'

export async function listerVilles(): Promise<Ville[]> {
  const { data, error } = await supabase.from('villes_geo').select('*').order('nom')
  if (error) throw new Error('Impossible de charger les villes.')

  const villes: Ville[] = []
  for (const v of data) {
    // Les vues rendent des colonnes nullables : on écarte une ligne incomplète
    if (v.id === null || v.nom === null || v.rayon_km === null || v.latitude === null || v.longitude === null) continue
    villes.push({ id: v.id, nom: v.nom, rayonKm: v.rayon_km, latitude: v.latitude, longitude: v.longitude })
  }
  return villes
}

export async function listerQuartiers(villeId: number): Promise<Quartier[]> {
  const { data, error } = await supabase
    .from('quartiers_geo')
    .select('*')
    .eq('ville_id', villeId)
    .order('nom')
  if (error) throw new Error('Impossible de charger les quartiers.')

  const quartiers: Quartier[] = []
  for (const q of data) {
    if (q.id === null || q.nom === null || q.ville_id === null) continue
    quartiers.push({
      id: q.id,
      nom: q.nom,
      villeId: q.ville_id,
      commune: q.commune,
      latitude: q.latitude,
      longitude: q.longitude,
    })
  }
  return quartiers
}

/**
 * Liste les universités, avec ou sans position (RG25 bis).
 * Sans villeId, toutes les villes sont concernées.
 */
export async function listerUniversites(villeId?: number): Promise<Universite[]> {
  let requete = supabase.from('universites_geo').select('*')
  if (villeId !== undefined) requete = requete.eq('ville_id', villeId)
  const { data, error } = await requete.order('nom')
  if (error) throw new Error('Impossible de charger les universités.')

  const universites: Universite[] = []
  for (const u of data) {
    if (u.id === null || u.nom === null || u.ville_id === null) continue
    universites.push({
      id: u.id,
      nom: u.nom,
      sigle: u.sigle,
      villeId: u.ville_id,
      quartierId: u.quartier_id,
      adresse: u.adresse,
      latitude: u.latitude,
      longitude: u.longitude,
    })
  }
  return universites
}
