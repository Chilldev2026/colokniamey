// Seul endroit du sous-module « référentiel » (écriture) qui appelle Supabase. La lecture passe par le module M1.
// Les exceptions de la base (code P0001 : zone de la ville, élément utilisé…) sont déjà en français.
import { supabase } from '@/core/supabase'
import { messageErreur } from '../../services/adminService'
import { versEwkt, type Point } from '../geo'

export interface Equipement {
  id: number
  nom: string
  actif: boolean
  ordre: number
}

export type TableReferentiel = 'villes' | 'quartiers' | 'universites' | 'equipements'

export interface DonneesVille {
  nom: string
  rayonKm: number
  centre: Point
}
export interface DonneesQuartier {
  nom: string
  villeId: number
  commune: string
  centre: Point | null
}
export interface DonneesUniversite {
  nom: string
  sigle: string
  villeId: number
  quartierId: number | null
  adresse: string
  position: Point | null
}
export interface DonneesEquipement {
  nom: string
  actif: boolean
  ordre: number
}

function verifier(erreur: { code?: string; message?: string; details?: string } | null): void {
  if (!erreur) return
  // Doublon (nom déjà pris) : message clair plutôt que générique
  if (erreur.code === '23505') throw new Error('Un élément porte déjà ce nom.')
  if (erreur.code === '42501') throw new Error('Action non autorisée.')
  throw new Error(messageErreur(erreur))
}

export async function listerEquipements(): Promise<Equipement[]> {
  const { data, error } = await supabase.from('equipements').select('id, nom, actif, ordre').order('ordre').order('nom')
  verifier(error)
  return data ?? []
}

export async function enregistrerVille(id: number | null, d: DonneesVille): Promise<void> {
  const ligne = { nom: d.nom.trim(), rayon_km: d.rayonKm, centre: versEwkt(d.centre) }
  const { error } = id === null ? await supabase.from('villes').insert(ligne) : await supabase.from('villes').update(ligne).eq('id', id)
  verifier(error)
}

export async function enregistrerQuartier(id: number | null, d: DonneesQuartier): Promise<void> {
  const ligne = { nom: d.nom.trim(), ville_id: d.villeId, commune: d.commune.trim() || null, centre: d.centre ? versEwkt(d.centre) : null }
  const { error } = id === null ? await supabase.from('quartiers').insert(ligne) : await supabase.from('quartiers').update(ligne).eq('id', id)
  verifier(error)
}

/** RG25 bis : la position est facultative ; sans elle, l'université reste proposée mais n'a pas de marqueur. */
export async function enregistrerUniversite(id: number | null, d: DonneesUniversite): Promise<void> {
  const ligne = {
    nom: d.nom.trim(),
    sigle: d.sigle.trim() || null,
    ville_id: d.villeId,
    quartier_id: d.quartierId,
    adresse: d.adresse.trim() || null,
    position: d.position ? versEwkt(d.position) : null,
  }
  const { error } = id === null ? await supabase.from('universites').insert(ligne) : await supabase.from('universites').update(ligne).eq('id', id)
  verifier(error)
}

export async function enregistrerEquipement(id: number | null, d: DonneesEquipement): Promise<void> {
  const ligne = { nom: d.nom.trim(), actif: d.actif, ordre: d.ordre }
  const { error } = id === null ? await supabase.from('equipements').insert(ligne) : await supabase.from('equipements').update(ligne).eq('id', id)
  verifier(error)
}

/** La base refuse, avec un message clair, la suppression d'un élément utilisé. */
export async function supprimer(table: TableReferentiel, id: number): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  verifier(error)
}
