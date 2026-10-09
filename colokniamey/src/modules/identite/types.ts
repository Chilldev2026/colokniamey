// Types du module K (vérification d'identité).

export type StatutKyc = 'non_soumis' | 'en_attente' | 'valide' | 'refuse'
export type TypePiece = 'cni' | 'passeport'
export type ImageKyc = 'recto' | 'verso' | 'selfie'

export const LIBELLES_PIECE: Record<TypePiece, string> = {
  cni: 'Carte nationale d\'identité',
  passeport: 'Passeport',
}

/** État du dossier de la personne connectée (fonction mon_kyc). Jamais de chemin ni d'image. */
export interface EtatKyc {
  verificationId: string | null
  statut: StatutKyc
  motifRefus: string | null
  typePiece: TypePiece | null
  /** Code à écrire sur la feuille du selfie : seulement pendant la préparation du dossier. */
  codeSelfie: string | null
  consentement: boolean
  recto: boolean
  verso: boolean
  selfie: boolean
  decideLe: string | null
  /** Vrai si l'identité est vérifiée aujourd'hui (nom, prénom et photo identiques à ceux validés). */
  verifiee: boolean
  dossiersRestants: number
}

export interface EtatAvatarKyc {
  valide: boolean
  enAttente: boolean
  refusee: boolean
  motif: string | null
}

/** Étapes du parcours (maquette « Vérification de docs »). */
export type EtapeKyc = 'photo' | 'piece' | 'selfie' | 'envoi'
export const ETAPES_KYC: { id: EtapeKyc; libelle: string }[] = [
  { id: 'photo', libelle: 'Photo de profil' },
  { id: 'piece', libelle: 'Pièce d\'identité' },
  { id: 'selfie', libelle: 'Selfie' },
  { id: 'envoi', libelle: 'Envoi' },
]

/** Étape à afficher d'après l'état du dossier : on reprend là où la personne s'était arrêtée. */
export function etapeCourante(etat: EtatKyc, avatar: EtatAvatarKyc): EtapeKyc {
  if (!avatar.valide) return 'photo'
  if (!etat.consentement || !etat.recto || !etat.verso) return 'piece'
  if (!etat.selfie) return 'selfie'
  return 'envoi'
}
