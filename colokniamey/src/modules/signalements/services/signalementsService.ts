// Seul endroit du module M7 qui appelle Supabase. Un signalement ne s'écrit que par la fonction signaler() : elle vérifie que
// le contenu est visible, interdit l'auto-signalement et les doublons, limite à 10 par jour (RGP20) et, pour un message,
// garde la copie du seul message visé (RGA10).
import { supabase } from '@/core/supabase'
import { controlerTexte, messageErreurContenu } from '@/modules/securite'

export type CibleSignalement = 'annonce' | 'profil' | 'message'
export type MotifSignalement = 'arnaque' | 'contenu_inapproprie' | 'fausse_annonce' | 'harcelement' | 'autre'
export type StatutSignalement = 'nouveau' | 'en_cours' | 'traite' | 'rejete'

export const LIBELLES_MOTIF: Record<MotifSignalement, string> = {
  arnaque: 'Arnaque ou demande d\'argent suspecte',
  contenu_inapproprie: 'Contenu inapproprié',
  fausse_annonce: 'Fausse annonce',
  harcelement: 'Harcèlement ou comportement déplacé',
  autre: 'Autre',
}
export const LIBELLES_CIBLE: Record<CibleSignalement, string> = { annonce: 'Annonce', profil: 'Profil', message: 'Message' }
export const LIBELLES_STATUT: Record<StatutSignalement, string> = {
  nouveau: 'Envoyé',
  en_cours: 'En cours d\'examen',
  traite: 'Traité',
  rejete: 'Examiné, sans suite',
}
export const COMMENTAIRE_MAX = 500

export interface MonSignalement {
  id: number
  cible: CibleSignalement
  motif: MotifSignalement
  commentaire: string | null
  statut: StatutSignalement
  creeLe: string
}

function motif(v: string): MotifSignalement {
  return v === 'arnaque' || v === 'contenu_inapproprie' || v === 'fausse_annonce' || v === 'harcelement' ? v : 'autre'
}
function statut(v: string): StatutSignalement {
  return v === 'en_cours' || v === 'traite' || v === 'rejete' ? v : 'nouveau'
}

/** RG20 : signale une annonce, un profil ou un message reçu. */
export async function signaler(cible: CibleSignalement, cibleId: string, motifChoisi: MotifSignalement, commentaire: string): Promise<void> {
  const texte = commentaire.trim()
  if (texte.length > COMMENTAIRE_MAX) throw new Error(`Le commentaire fait ${COMMENTAIRE_MAX} caractères au plus.`)
  // RG45, RG47 : un commentaire interdit est refusé avant l'envoi (et le blocage est journalisé)
  if (texte !== '' && (await controlerTexte(texte, 'prive')) === 'bloque') {
    throw new Error('Ce texte ne respecte pas les règles de ColokNiamey. Modifie-le et réessaie.')
  }
  const { error } = await supabase.rpc('signaler', {
    p_cible_type: cible, p_cible_id: cibleId, p_motif: motifChoisi, ...(texte ? { p_commentaire: texte } : {}),
  })
  if (error) throw new Error(messageErreurContenu(error))
}

export async function listerMesSignalements(): Promise<MonSignalement[]> {
  const { data, error } = await supabase
    .from('signalements')
    .select('id, cible_type, motif, commentaire, statut, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error('Impossible de charger tes signalements.')
  return data.map((s) => ({
    id: s.id,
    cible: s.cible_type === 'profil' || s.cible_type === 'message' ? s.cible_type : 'annonce',
    motif: motif(s.motif),
    commentaire: s.commentaire,
    statut: statut(s.statut),
    creeLe: s.created_at,
  }))
}
