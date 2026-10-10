// Seul endroit du module A4 qui appelle Supabase (affichage public). La gestion est dans admin/communiques.
// communiques_actifs() est ouverte aux visiteurs : un visiteur ne voit que les communiqués pour « tous » (RGA13).
import { supabase } from '@/core/supabase'

export type NiveauCommunique = 'information' | 'avertissement' | 'critique'

export interface Communique {
  id: number
  titre: string
  message: string
  niveau: NiveauCommunique
  fin: string
  /** Faux pour un communiqué critique : il ne peut pas être masqué (RGA14). */
  masquable: boolean
}

export function niveauCommunique(v: string): NiveauCommunique {
  return v === 'critique' || v === 'avertissement' ? v : 'information'
}

export async function lireCommuniquesActifs(): Promise<Communique[]> {
  const { data, error } = await supabase.rpc('communiques_actifs')
  // Un communiqué n'est jamais indispensable : en cas d'échec, on n'affiche rien plutôt qu'une erreur
  if (error) return []
  return data.map((c) => ({ id: c.id, titre: c.titre, message: c.message, niveau: niveauCommunique(c.niveau), fin: c.fin, masquable: c.masquable }))
}

export async function masquerCommunique(id: number): Promise<void> {
  const { error } = await supabase.rpc('masquer_communique', { p_id: id })
  if (error) throw new Error('Impossible de masquer ce communiqué.')
}
