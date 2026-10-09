// Seul endroit du module qui appelle Supabase (textes et photos).

import { supabase } from '@/core/supabase'

export type IssueTexte = 'accepte' | 'revue' | 'bloque'
export type UsagePhoto = 'avatar' | 'annonce'

const GENERIQUE = 'Une erreur est survenue. Réessaie dans un moment.'

/**
 * Message à montrer pour une erreur renvoyée par la base.
 * Les exceptions levées par nos fonctions et déclencheurs (code P0001) sont déjà en français et
 * sans détail technique ; toute autre erreur reste générique.
 */
export function messageErreurContenu(erreur: { code?: string; message?: string } | null | undefined): string {
  if (erreur?.code === 'P0001' && erreur.message) return erreur.message
  if (erreur?.code === '42501') return 'Action non autorisée.'
  return GENERIQUE
}

/**
 * RG45, RG47 : demande à la base ce qu'elle ferait de ce texte, et journalise un blocage.
 * Sert au confort du formulaire ; le déclencheur de la table reste la vraie protection.
 * À appeler aussi après un refus du déclencheur, pour que le blocage soit journalisé (RG47).
 */
export async function controlerTexte(texte: string, contexte: 'public' | 'prive' = 'public'): Promise<IssueTexte> {
  const { data, error } = await supabase.rpc('controler_texte', { p_texte: texte, p_contexte: contexte })
  if (error) throw new Error(messageErreurContenu(error))
  return data === 'bloque' || data === 'revue' ? data : 'accepte'
}

/** RG50 : vérifie l'empreinte avant l'envoi, pour ne pas téléverser une image déjà refusée. */
export async function precontrolerPhoto(empreinte: string): Promise<void> {
  const { error } = await supabase.rpc('precontroler_photo', { p_empreinte: empreinte })
  if (error) throw new Error(messageErreurContenu(error))
}

/**
 * RG49 : dépose la photo dans le bucket privé photos_en_attente, dans le dossier de l'auteur,
 * puis l'enregistre (statut en_attente). Elle n'est publiée qu'après validation par un admin.
 */
export async function televerserPhoto(blob: Blob, usage: UsagePhoto, empreinte: string): Promise<number> {
  const { data: utilisateur } = await supabase.auth.getUser()
  if (!utilisateur.user) throw new Error('Connexion requise.')

  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const chemin = `${utilisateur.user.id}/${crypto.randomUUID()}.${extension}`

  const { error: erreurEnvoi } = await supabase.storage
    .from('photos_en_attente')
    .upload(chemin, blob, { contentType: blob.type, upsert: false })
  if (erreurEnvoi) {
    // La politique Storage appelle verifier_quota() : au-delà de 30 envois par jour, elle lève une erreur
    throw new Error(
      /trop de demandes/i.test(erreurEnvoi.message)
        ? 'Tu as envoyé beaucoup de photos aujourd\'hui. Réessaie demain.'
        : GENERIQUE,
    )
  }

  const { data, error } = await supabase.rpc('enregistrer_photo', {
    p_chemin: chemin,
    p_usage: usage,
    p_empreinte: empreinte,
  })
  if (error || typeof data !== 'number') throw new Error(messageErreurContenu(error))
  return data
}

/** RG49 : décision d'un admin, par l'Edge Function securite-photos-decision (utilisée par A3). */
export async function deciderPhoto(photoId: number, decision: 'valider' | 'refuser', motif?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('securite-photos-decision', {
    body: { photo_id: photoId, decision, motif },
  })
  if (error) throw new Error('La décision n\'a pas pu être enregistrée. Réessaie.')
}
