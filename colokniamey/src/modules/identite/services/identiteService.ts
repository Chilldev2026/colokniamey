// Seul endroit du module K (côté étudiant) qui appelle Supabase.
// Les exceptions levées par nos fonctions SQL (code P0001) et les erreurs des Edge Functions sont en français
// et sans détail technique : on les montre ; toute autre erreur reste générique.

import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/core/supabase'
import type { EtatAvatarKyc, EtatKyc, ImageKyc, StatutKyc, TypePiece } from '../types'

const GENERIQUE = 'Une erreur est survenue. Réessaie dans un moment.'

function messageSql(erreur: { code?: string; message?: string } | null): string {
  return erreur?.code === 'P0001' && erreur.message ? erreur.message : GENERIQUE
}

/** Message d'une Edge Function : le corps JSON { erreur } des réponses d'erreur. */
export async function messageFonction(erreur: unknown): Promise<string> {
  if (erreur instanceof FunctionsHttpError) {
    try {
      const corps: unknown = await erreur.context.json()
      if (typeof corps === 'object' && corps !== null && 'erreur' in corps && typeof corps.erreur === 'string') {
        return corps.erreur
      }
    } catch {
      // corps illisible : message générique
    }
  }
  return GENERIQUE
}

function statutKyc(valeur: string | null | undefined): StatutKyc {
  return valeur === 'en_attente' || valeur === 'valide' || valeur === 'refuse' ? valeur : 'non_soumis'
}

/** État du dossier de la personne connectée. */
export async function lireMonKyc(): Promise<EtatKyc> {
  const { data, error } = await supabase.rpc('mon_kyc')
  if (error) throw new Error(messageSql(error))
  const l = data[0]
  return {
    verificationId: l?.verification_id ?? null,
    statut: statutKyc(l?.statut),
    motifRefus: l?.motif_refus ?? null,
    typePiece: l?.type_piece === 'cni' || l?.type_piece === 'passeport' ? l.type_piece : null,
    codeSelfie: l?.code_selfie ?? null,
    consentement: l?.consentement === true,
    recto: l?.recto === true,
    verso: l?.verso === true,
    selfie: l?.selfie === true,
    decideLe: l?.decide_le ?? null,
    verifiee: l?.verifiee === true,
    dossiersRestants: Number(l?.dossiers_restants ?? 0),
  }
}

/** RG51 : la photo de profil doit être validée avant tout dépôt. Lecture par la fonction de M3 (mon_avatar). */
export async function lireAvatarPourKyc(): Promise<EtatAvatarKyc> {
  const { data, error } = await supabase.rpc('mon_avatar')
  if (error) throw new Error(messageSql(error))
  const l = data[0]
  return {
    valide: l?.chemin_valide != null,
    enAttente: l?.statut === 'en_attente',
    refusee: l?.statut === 'refusee',
    motif: l?.motif ?? null,
  }
}

/** Ouvre le dossier (ou reprend celui en cours), enregistre le consentement, et renvoie l'identifiant. */
export async function commencerDossier(): Promise<string> {
  const { data, error } = await supabase.rpc('demarrer_kyc')
  if (error) throw new Error(messageSql(error))
  const ligne = data[0]
  if (!ligne) throw new Error(GENERIQUE)
  const consentement = await supabase.rpc('consentir_kyc')
  if (consentement.error) throw new Error(messageSql(consentement.error))
  return ligne.verification_id
}

async function enBase64(blob: Blob): Promise<string> {
  const octets = new Uint8Array(await blob.arrayBuffer())
  let binaire = ''
  const pas = 0x8000
  for (let i = 0; i < octets.length; i += pas) {
    binaire += String.fromCharCode(...octets.subarray(i, i + pas))
  }
  return btoa(binaire)
}

/** RG53, RG55 : l'image préparée (WebP sans EXIF, empreinte) part vers l'Edge Function, qui la chiffre. */
export async function deposerImage(verificationId: string, type: ImageKyc, image: Blob, empreinte: string): Promise<void> {
  const { error } = await supabase.functions.invoke('kyc-depot', {
    body: { action: 'deposer', verification_id: verificationId, type, image: await enBase64(image), empreinte },
  })
  if (error) throw new Error(await messageFonction(error))
}

export async function soumettreDossier(typePiece: TypePiece): Promise<void> {
  const { error } = await supabase.rpc('soumettre_kyc', { p_type_piece: typePiece })
  if (error) throw new Error(messageSql(error))
}

/** Retire le consentement et efface aussitôt les images (Edge Function kyc-depot). */
export async function annulerDossier(): Promise<void> {
  const { error } = await supabase.functions.invoke('kyc-depot', { body: { action: 'annuler' } })
  if (error) throw new Error(await messageFonction(error))
}

/** Badge public : seul un booléen sort de la base. */
export async function lireIdentiteVerifiee(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('identite_verifiee', { p_uid: userId })
  if (error) return false
  return data === true
}
