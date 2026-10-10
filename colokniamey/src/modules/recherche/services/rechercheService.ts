// Seul endroit du module M5 qui appelle Supabase. La recherche et la carte sont ouvertes aux visiteurs (RG24) ; elles ne
// renvoient que la position PUBLIQUE des annonces (RG23). Les favoris ne sont lisibles que par leur propriétaire (RLS).
import { supabase } from '@/core/supabase'
import { messageErreurContenu } from '@/modules/securite'
import { versFiltresBase, type FiltresRecherche, type TriRecherche } from '../types'

export interface ResultatAnnonce {
  id: number
  type: string
  titre: string
  partMensuelle: number
  loyerTotal: number | null
  nbPlaces: number
  quartierId: number
  universiteProcheId: number | null
  disponibleLe: string | null
  photoChemin: string | null
  latitude: number | null
  longitude: number | null
  zoneRayonM: number
  distanceUniversiteM: number | null
  distanceRefM: number | null
  curseurValeur: string
}

export interface MarqueurCarte {
  id: number
  type: string
  titre: string
  partMensuelle: number
  quartierId: number
  photoChemin: string | null
  latitude: number
  longitude: number
  zoneRayonM: number
  distanceRefM: number | null
  groupeEnFormation: boolean
}

export interface Emprise {
  sud: number
  ouest: number
  nord: number
  est: number
}

export const TAILLE_PAGE = 20

export async function rechercherAnnonces(
  filtres: FiltresRecherche,
  villeId: number | undefined,
  curseur: { v: string; id: number } | null,
): Promise<ResultatAnnonce[]> {
  const { data, error } = await supabase.rpc('rechercher_annonces', {
    p_filtres: versFiltresBase(filtres, villeId) as never,
    p_tri: filtres.tri as TriRecherche,
    p_limite: TAILLE_PAGE,
    ...(curseur ? { p_curseur: curseur } : {}),
  })
  if (error) throw new Error('La recherche a échoué. Réessaie dans un moment.')
  return data.map((a) => ({
    id: a.id, type: a.type, titre: a.titre, partMensuelle: a.part_mensuelle_fcfa, loyerTotal: a.loyer_total_fcfa ?? null, nbPlaces: a.nb_places,
    quartierId: a.quartier_id, universiteProcheId: a.universite_proche_id ?? null, disponibleLe: a.disponible_le ?? null,
    photoChemin: a.photo_chemin ?? null, latitude: a.latitude ?? null, longitude: a.longitude ?? null, zoneRayonM: a.zone_rayon_m,
    distanceUniversiteM: a.distance_universite_m ?? null, distanceRefM: a.distance_ref_m ?? null, curseurValeur: a.curseur_valeur,
  }))
}

/** Annonces publiées dans la zone visible de la carte (RG24). */
export async function annoncesCarte(emprise: Emprise, filtres: FiltresRecherche, villeId: number | undefined): Promise<MarqueurCarte[]> {
  const { data, error } = await supabase.rpc('annonces_carte', {
    p_emprise: { sud: emprise.sud, ouest: emprise.ouest, nord: emprise.nord, est: emprise.est },
    p_filtres: versFiltresBase(filtres, villeId) as never,
  })
  if (error) throw new Error('La carte n\'a pas pu être chargée. Réessaie dans un moment.')
  const marqueurs: MarqueurCarte[] = []
  for (const a of data) {
    if (a.latitude === null || a.longitude === null) continue
    marqueurs.push({
      id: a.id, type: a.type, titre: a.titre, partMensuelle: a.part_mensuelle_fcfa, quartierId: a.quartier_id, photoChemin: a.photo_chemin ?? null,
      latitude: a.latitude, longitude: a.longitude, zoneRayonM: a.zone_rayon_m, distanceRefM: a.distance_ref_m ?? null,
      groupeEnFormation: a.groupe_en_formation,
    })
  }
  return marqueurs
}

export function urlPhoto(chemin: string): string {
  return supabase.storage.from('photos_publiques').getPublicUrl(chemin).data.publicUrl
}

// --- Favoris ---

export async function listerIdsFavoris(): Promise<number[]> {
  const { data, error } = await supabase.from('favoris').select('annonce_id')
  if (error) throw new Error('Impossible de charger tes favoris.')
  return data.map((f) => f.annonce_id)
}

export async function ajouterFavori(annonceId: number): Promise<void> {
  const { error } = await supabase.from('favoris').insert({ annonce_id: annonceId })
  if (error && error.code !== '23505') throw new Error(messageErreurContenu(error))
}

export async function retirerFavori(annonceId: number): Promise<void> {
  const { error } = await supabase.from('favoris').delete().eq('annonce_id', annonceId)
  if (error) throw new Error(messageErreurContenu(error))
}

export async function listerMesFavoris(): Promise<ResultatAnnonce[]> {
  const { data, error } = await supabase.rpc('mes_favoris')
  if (error) throw new Error('Impossible de charger tes favoris.')
  const resultats: ResultatAnnonce[] = []
  for (const a of data) {
    if (a.id === null || a.titre === null || a.part_mensuelle_fcfa === null || a.quartier_id === null) continue
    resultats.push({
      id: a.id, type: String(a.type), titre: a.titre, partMensuelle: a.part_mensuelle_fcfa, loyerTotal: a.loyer_total_fcfa ?? null,
      nbPlaces: Number(a.nb_places ?? 1), quartierId: a.quartier_id, universiteProcheId: a.universite_proche_id ?? null,
      disponibleLe: a.disponible_le ?? null, photoChemin: a.photo_chemin ?? null, latitude: a.latitude ?? null, longitude: a.longitude ?? null,
      zoneRayonM: Number(a.zone_rayon_m ?? 0), distanceUniversiteM: a.distance_universite_m ?? null, distanceRefM: null, curseurValeur: '',
    })
  }
  return resultats
}

/** Photos validées d'une annonce publiée, dans l'ordre choisi par l'auteur (galerie plein écran). */
export async function listerPhotosPubliques(annonceId: number): Promise<string[]> {
  const { data, error } = await supabase.rpc('photos_annonce', { p_annonce_id: annonceId })
  if (error) throw new Error('Impossible de charger les photos.')
  return data.map((p) => urlPhoto(p.chemin))
}

/**
 * Badge « N groupes cherchent des colocataires » (M8) : un nombre par annonce. Si le module M8 n'est pas installé en
 * base, la fonction n'existe pas : on renvoie simplement « aucun badge ».
 */
export async function compterGroupes(annonceIds: number[]): Promise<Map<number, number>> {
  const resultat = new Map<number, number>()
  if (annonceIds.length === 0) return resultat
  const { data, error } = await supabase.rpc('compter_groupes_annonces', { p_ids: annonceIds.slice(0, 100) })
  if (error) return resultat
  for (const l of data) resultat.set(l.annonce_id, l.nombre)
  return resultat
}
