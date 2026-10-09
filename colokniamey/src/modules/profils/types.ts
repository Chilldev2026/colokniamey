// Types du module M3 (profils).

export type RoleProfil = 'etudiant' | 'proprietaire'

/** Profil public minimal d'un autre utilisateur : jamais de nom complet, de téléphone ni d'e-mail. */
export interface ProfilPublic {
  id: string
  prenom: string
  /** Initiale du nom de famille, en majuscule. */
  initialeNom: string
  role: RoleProfil
  /** Étudiant : université (avec son sigle). */
  universite: string | null
  /** Propriétaire : particulier ou agence. */
  typeProprietaire: 'particulier' | 'agence' | null
  membreDepuis: string
  /** Chemin de l'avatar validé dans photos_publiques, ou null. */
  avatarChemin: string | null
  profession: string | null
  centresInteret: string[]
}

/** Profil complet de la personne connectée (ses propres données). */
export interface MonProfil {
  id: string
  role: 'etudiant' | 'proprietaire' | 'admin' | 'super_admin'
  statut: 'actif' | 'suspendu' | 'desactive'
  nom: string
  prenom: string
  telephone: string
  etudiant: {
    universiteId: string
    niveauEtude: string
    filiere: string
    budgetMax: string
    bio: string
  } | null
  proprietaire: {
    typeProprietaire: 'particulier' | 'agence'
    adresse: string
  } | null
  profession: string
  centresInteret: string[]
}

/** Valeurs saisies dans le formulaire (tout en texte). */
export interface DonneesProfil {
  nom: string
  prenom: string
  telephone: string
  universiteId: string
  niveauEtude: string
  filiere: string
  budgetMax: string
  bio: string
  typeProprietaire: 'particulier' | 'agence'
  adresse: string
  profession: string
  /** Centres d'intérêt séparés par des virgules. */
  centresInteret: string
}

export interface EtatAvatar {
  cheminValide: string | null
  /** État du dernier envoi : null = aucun envoi. */
  statut: 'en_attente' | 'validee' | 'refusee' | null
  motif: string | null
}

export const LIBELLES_STATUT = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  desactive: 'Désactivé',
} as const
