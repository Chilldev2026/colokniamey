// Seul endroit du sous-module « identités » qui appelle Supabase (K, côté admin).
// Les images ne passent que par l'Edge Function kyc-consulter : aucune URL, rien n'est gardé en cache (RG55).
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/core/supabase'
import { messageErreur } from '../../services/adminService'

export type StatutFile = 'en_attente' | 'valide' | 'refuse'
export type ImageDossier = 'recto' | 'verso' | 'selfie'

export interface LigneDossier {
  id: string
  prenom: string
  nom: string
  typePiece: string | null
  statut: string
  suspect: boolean
  soumisLe: string | null
  decideLe: string | null
}

export interface FicheDossier {
  id: string
  prenom: string
  nom: string
  avatarChemin: string | null
  typePiece: string | null
  codeSelfie: string
  statut: string
  suspect: boolean
  soumisLe: string | null
  motifRefus: string | null
  imagesDisponibles: boolean
}

/** Dossiers d'un statut, le plus ancien d'abord (RG54). La base refuse tout appel hors aal2. */
export async function listerDossiers(statut: StatutFile): Promise<LigneDossier[]> {
  const { data, error } = await supabase.rpc('liste_dossiers_kyc', { p_statut: statut })
  if (error) throw new Error(messageErreur(error))
  return data.map((d) => ({
    id: d.id,
    prenom: d.prenom,
    nom: d.nom,
    typePiece: d.type_piece ?? null,
    statut: d.statut,
    suspect: d.suspect,
    soumisLe: d.soumis_le ?? null,
    decideLe: d.decide_le ?? null,
  }))
}

export async function lireDossier(id: string): Promise<FicheDossier | null> {
  const { data, error } = await supabase.rpc('dossier_kyc_admin', { p_id: id })
  if (error) throw new Error(messageErreur(error))
  const d = data[0]
  if (!d) return null
  return {
    id: d.id,
    prenom: d.prenom,
    nom: d.nom,
    avatarChemin: d.avatar_chemin ?? null,
    typePiece: d.type_piece ?? null,
    codeSelfie: d.code_selfie,
    statut: d.statut,
    suspect: d.suspect,
    soumisLe: d.soumis_le ?? null,
    motifRefus: d.motif_refus ?? null,
    imagesDisponibles: d.images_disponibles,
  }
}

/**
 * RG55 : demande l'image à kyc-consulter (aal2 vérifié, consultation journalisée). Elle est lue en mémoire et
 * montrée par une adresse locale de l'onglet (blob:), à libérer avec URL.revokeObjectURL dès que l'écran se ferme.
 */
export async function consulterImage(id: string, image: ImageDossier): Promise<string> {
  const { data, error } = await supabase.functions.invoke('kyc-consulter', { body: { verification_id: id, image } })
  if (error) {
    let message = 'Cette image n\'a pas pu être chargée.'
    if (error instanceof FunctionsHttpError) {
      try {
        const corps: unknown = await error.context.json()
        if (typeof corps === 'object' && corps !== null && 'erreur' in corps && typeof corps.erreur === 'string') message = corps.erreur
      } catch {
        // message par défaut
      }
    }
    throw new Error(message)
  }
  if (!(data instanceof Blob)) throw new Error('Cette image n\'a pas pu être chargée.')
  // Le serveur répond en octet-stream (nosniff) : on déclare nous-mêmes le type d'image
  return URL.createObjectURL(new Blob([data], { type: 'image/webp' }))
}

/** Valider ou refuser (motif obligatoire pour un refus, vérifié par la base). */
export async function deciderDossier(id: string, valide: boolean, motif?: string): Promise<void> {
  const { error } = await supabase.rpc('decider_kyc', { p_id: id, p_valide: valide, ...(motif ? { p_motif: motif } : {}) })
  if (error) throw new Error(messageErreur(error))
}
