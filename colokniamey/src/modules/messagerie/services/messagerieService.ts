// Seul endroit du module M6 qui appelle Supabase. Les messages sont confidentiels : seuls les deux participants les lisent
// (RLS), aucun admin (RGA10). Le temps réel passe par l'abonnement aux changements de la table messages, filtrés par la RLS
// (RGP23) : un tiers n'en reçoit aucun. Aucun canal public.
import { supabase } from '@/core/supabase'
import { controlerTexte, messageErreurContenu } from '@/modules/securite'

export interface ConversationResume {
  id: number
  annonceId: number | null
  annonceTitre: string | null
  autreId: string
  autrePrenom: string
  autreInitiale: string
  dernierMessageLe: string
  nonLus: number
}

export interface Message {
  id: number
  conversationId: number
  expediteurId: string
  contenu: string
  luLe: string | null
  creeLe: string
}

export const LONGUEUR_MAX = 2000

const ECHEC = 'Une erreur est survenue. Réessaie dans un moment.'

export async function listerConversations(): Promise<ConversationResume[]> {
  const { data, error } = await supabase.rpc('liste_conversations')
  if (error) throw new Error(ECHEC)
  return data.map((c) => ({
    id: c.id, annonceId: c.annonce_id ?? null, annonceTitre: c.annonce_titre ?? null, autreId: c.autre_id, autrePrenom: c.autre_prenom,
    autreInitiale: c.autre_initiale, dernierMessageLe: c.dernier_message_le, nonLus: c.non_lus,
  }))
}

function versMessage(m: { id: number; conversation_id: number; expediteur_id: string; contenu: string; lu_le: string | null; created_at: string }): Message {
  return { id: m.id, conversationId: m.conversation_id, expediteurId: m.expediteur_id, contenu: m.contenu, luLe: m.lu_le, creeLe: m.created_at }
}

export async function lireMessages(conversationId: number): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, expediteur_id, contenu, lu_le, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(500)
  if (error) throw new Error(ECHEC)
  return data.map(versMessage)
}

/**
 * RG45, RG47 : le contrôle de S (contexte privé : blocage seulement) journalise un blocage avant l'envoi.
 * Le déclencheur de la table reste la vraie protection.
 */
async function verifierTexte(texte: string): Promise<void> {
  if ((await controlerTexte(texte, 'prive')) === 'bloque') {
    throw new Error('Ce message ne respecte pas les règles de ColokNiamey. Modifie-le et réessaie.')
  }
}

export async function envoyerMessage(conversationId: number, contenu: string): Promise<Message> {
  const texte = contenu.trim()
  if (texte === '' || texte.length > LONGUEUR_MAX) throw new Error(`Un message fait entre 1 et ${LONGUEUR_MAX} caractères.`)
  await verifierTexte(texte)
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, contenu: texte })
    .select('id, conversation_id, expediteur_id, contenu, lu_le, created_at')
    .single()
  if (error) throw new Error(messageErreurContenu(error))
  return versMessage(data)
}

/** RG19 : contacter l'auteur d'une annonce publiée. Renvoie la conversation (nouvelle ou déjà ouverte). */
export async function demarrerConversation(annonceId: number, premierMessage: string): Promise<number> {
  const texte = premierMessage.trim()
  if (texte === '' || texte.length > LONGUEUR_MAX) throw new Error(`Un message fait entre 1 et ${LONGUEUR_MAX} caractères.`)
  await verifierTexte(texte)
  const { data, error } = await supabase.rpc('demarrer_conversation', { p_annonce_id: annonceId, p_message: texte })
  if (error || typeof data !== 'number') throw new Error(messageErreurContenu(error))
  return data
}

export async function conversationDeLAnnonce(annonceId: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('ma_conversation_annonce', { p_annonce_id: annonceId })
  if (error) return null
  return typeof data === 'number' ? data : null
}

export async function marquerLu(conversationId: number): Promise<void> {
  await supabase.rpc('marquer_lu', { p_conversation_id: conversationId })
}

export async function compterNonLus(): Promise<number> {
  const { data, error } = await supabase.rpc('mes_messages_non_lus')
  return error || typeof data !== 'number' ? 0 : data
}

/**
 * Fil en temps réel : chaque nouveau message de la conversation arrive sans recharger. La RLS filtre l'abonnement :
 * seule une personne participante reçoit les messages. Renvoie la fonction qui ferme l'abonnement.
 */
export function suivreConversation(conversationId: number, surMessage: (m: Message) => void): () => void {
  const canal = supabase
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (charge) => {
        const m = charge.new as Record<string, unknown>
        if (typeof m.id === 'number' && typeof m.contenu === 'string') {
          surMessage(
            versMessage({
              id: m.id, conversation_id: Number(m.conversation_id), expediteur_id: String(m.expediteur_id), contenu: m.contenu,
              lu_le: typeof m.lu_le === 'string' ? m.lu_le : null, created_at: String(m.created_at),
            }),
          )
        }
      },
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(canal)
  }
}
