// Seul endroit du sous-module « signalements » (A3, volet M7) qui appelle Supabase. Chaque fonction SQL revérifie
// est_admin() (aal2 + session active). L'admin ne reçoit que le message joint à un signalement (RGA10).
import { supabase } from '@/core/supabase'
import { messageErreur } from '../../services/adminService'

export type StatutFile = 'nouveau' | 'en_cours' | 'traite' | 'rejete'
export type Decision = 'rejeter' | 'retirer_annonce' | 'suspendre_auteur' | 'traiter'

export interface LigneSignalement {
  id: number
  cible: string
  motif: string
  statut: string
  nbSurLaCible: number
  prisParMoi: boolean
  prisParUnAutre: boolean
  creeLe: string
}

export interface FicheSignalement {
  id: number
  cible: 'annonce' | 'profil' | 'message'
  cibleId: string
  cibleAuteurId: string | null
  motif: string
  commentaire: string | null
  statut: string
  decision: string | null
  decisionCommentaire: string | null
  creeLe: string
  prisParMoi: boolean
  prisParUnAutre: boolean
  signalePar: string
  contexte: Record<string, unknown>
  historique: { id: number; motif: string; statut: string; decision: string | null; creeLe: string }[]
  autresSurLaPersonne: number
}

const texte = (v: unknown): string => (typeof v === 'string' ? v : '')
const nombre = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0))

export async function listerSignalements(statut: StatutFile, motif: string): Promise<LigneSignalement[]> {
  const { data, error } = await supabase.rpc('liste_signalements', { p_statut: statut, ...(motif ? { p_motif: motif } : {}) })
  if (error) throw new Error(messageErreur(error))
  return data.map((s) => ({
    id: s.id, cible: s.cible_type, motif: s.motif, statut: s.statut, nbSurLaCible: s.nb_sur_la_cible, prisParMoi: s.pris_par_moi,
    prisParUnAutre: s.pris_par_un_autre, creeLe: s.created_at,
  }))
}

export async function lireSignalement(id: number): Promise<FicheSignalement> {
  const { data, error } = await supabase.rpc('fiche_signalement', { p_id: id })
  if (error) throw new Error(messageErreur(error))
  const j = (typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}) as Record<string, unknown>
  const c = j.cible_type
  return {
    id: nombre(j.id),
    cible: c === 'profil' || c === 'message' ? c : 'annonce',
    cibleId: texte(j.cible_id),
    cibleAuteurId: typeof j.cible_auteur_id === 'string' ? j.cible_auteur_id : null,
    motif: texte(j.motif),
    commentaire: typeof j.commentaire === 'string' ? j.commentaire : null,
    statut: texte(j.statut),
    decision: typeof j.decision === 'string' ? j.decision : null,
    decisionCommentaire: typeof j.decision_commentaire === 'string' ? j.decision_commentaire : null,
    creeLe: texte(j.cree_le),
    prisParMoi: j.pris_par_moi === true,
    prisParUnAutre: j.pris_par_un_autre === true,
    signalePar: texte(j.signale_par),
    contexte: (typeof j.cible === 'object' && j.cible !== null ? j.cible : {}) as Record<string, unknown>,
    historique: (Array.isArray(j.historique) ? j.historique : []).map((h) => {
      const x = (h ?? {}) as Record<string, unknown>
      return { id: nombre(x.id), motif: texte(x.motif), statut: texte(x.statut), decision: typeof x.decision === 'string' ? x.decision : null, creeLe: texte(x.cree_le) }
    }),
    autresSurLaPersonne: nombre(j.autres_signalements_sur_la_personne),
  }
}

export async function prendreEnCharge(id: number): Promise<void> {
  const { error } = await supabase.rpc('prendre_en_charge_signalement', { p_id: id })
  if (error) throw new Error(messageErreur(error))
}

export async function relacher(id: number): Promise<void> {
  const { error } = await supabase.rpc('relacher_signalement', { p_id: id })
  if (error) throw new Error(messageErreur(error))
}

export async function cloturer(id: number, decision: Decision, commentaire: string): Promise<void> {
  const { error } = await supabase.rpc('cloturer_signalement', { p_id: id, p_decision: decision, ...(commentaire.trim() ? { p_commentaire: commentaire.trim() } : {}) })
  if (error) throw new Error(messageErreur(error))
}
