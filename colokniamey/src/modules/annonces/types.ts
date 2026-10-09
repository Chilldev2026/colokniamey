// Types du module M4 (annonces).

export type TypeAnnonce = 'chambre' | 'studio' | 'appartement' | 'place_colocation'
export type StatutAnnonce = 'brouillon' | 'en_attente' | 'publiee' | 'refusee' | 'archivee'
export type PrecisionPosition = 'exacte' | 'approximative'
export type PreferenceGenre = 'indifferent' | 'femme' | 'homme'
export type FrequenceTache = 'quotidienne' | 'hebdomadaire' | 'mensuelle'
export type RepartitionTache = 'tour_de_role' | 'fixe' | 'a_discuter'

export const LIBELLES_TYPE: Record<TypeAnnonce, string> = {
  chambre: 'Chambre',
  studio: 'Studio',
  appartement: 'Appartement',
  place_colocation: 'Place en colocation',
}

export const LIBELLES_STATUT: Record<StatutAnnonce, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En cours de vérification',
  publiee: 'Publiée',
  refusee: 'Refusée',
  archivee: 'Archivée',
}

export const LIBELLES_FREQUENCE: Record<FrequenceTache, string> = {
  quotidienne: 'Tous les jours',
  hebdomadaire: 'Chaque semaine',
  mensuelle: 'Chaque mois',
}

export const LIBELLES_REPARTITION: Record<RepartitionTache, string> = {
  tour_de_role: 'À tour de rôle',
  fixe: 'Personne fixe',
  a_discuter: 'À discuter',
}

export const LIBELLES_GENRE: Record<PreferenceGenre, string> = {
  indifferent: 'Pas de préférence',
  femme: 'Une femme',
  homme: 'Un homme',
}

/** Suggestions en un clic (RG30, RG31). Ce sont des exemples de formulation, pas des données du pays. */
export const REGLES_SUGGEREES = [
  'Pas de fumée dans le logement',
  'Pas de bruit après 22 h',
  'Pas de visiteurs pour la nuit sans prévenir',
  'Chacun range ses affaires personnelles',
  'Les décisions importantes se prennent ensemble',
]
export const TACHES_SUGGEREES: { libelle: string; frequence: FrequenceTache; repartition: RepartitionTache }[] = [
  { libelle: 'Faire la vaisselle', frequence: 'quotidienne', repartition: 'tour_de_role' },
  { libelle: 'Balayer et laver le sol', frequence: 'hebdomadaire', repartition: 'tour_de_role' },
  { libelle: 'Sortir les poubelles', frequence: 'hebdomadaire', repartition: 'tour_de_role' },
  { libelle: 'Nettoyer la cuisine', frequence: 'hebdomadaire', repartition: 'a_discuter' },
  { libelle: 'Nettoyer les sanitaires', frequence: 'hebdomadaire', repartition: 'tour_de_role' },
]

export const LIMITES = { regles: 10, regleCaracteres: 120, taches: 15, titre: 100, description: 2000 } as const

export interface LigneRegle {
  /** Identifiant en base ; absent tant que la ligne n'est pas enregistrée. */
  id?: number
  texte: string
}

export interface LigneTache {
  id?: number
  libelle: string
  frequence: FrequenceTache
  repartition: RepartitionTache
}

export interface PointCarte {
  latitude: number
  longitude: number
}

/** Valeurs du formulaire en étapes. Les champs numériques restent du texte tant qu'ils sont saisis. */
export interface FormulaireAnnonce {
  titre: string
  description: string
  type: TypeAnnonce
  nbPlaces: string
  partMensuelle: string
  loyerTotal: string
  chargesIncluses: boolean
  montantCharges: string
  quartierId: string
  universiteId: string
  disponibleLe: string
  equipementIds: number[]
  regles: LigneRegle[]
  taches: LigneTache[]
  position: PointCarte | null
  precision: PrecisionPosition
  dureeMin: string
  dureeMax: string
  contactWhatsapp: boolean
  contactAppel: boolean
  preferenceGenre: PreferenceGenre
  ageMin: string
  ageMax: string
  etudiantsUniquement: boolean
}

export function formulaireVide(type: TypeAnnonce): FormulaireAnnonce {
  return {
    titre: '', description: '', type, nbPlaces: type === 'place_colocation' ? '3' : '1', partMensuelle: '', loyerTotal: '',
    chargesIncluses: true, montantCharges: '', quartierId: '', universiteId: '', disponibleLe: '', equipementIds: [],
    regles: [], taches: [], position: null, precision: 'approximative', dureeMin: '', dureeMax: '',
    contactWhatsapp: false, contactAppel: false, preferenceGenre: 'indifferent', ageMin: '', ageMax: '', etudiantsUniquement: false,
  }
}

export interface PhotoAnnonceVue {
  /** Identifiant du lien photos_annonces. */
  id: number
  photoId: number
  ordre: number
  statut: 'en_attente' | 'validee' | 'refusee'
  motif: string | null
  chemin: string
}

/** Ligne de la liste « Mes annonces ». */
export interface AnnonceResume {
  id: number
  titre: string
  type: TypeAnnonce
  statut: StatutAnnonce
  motifRefus: string | null
  enRevue: boolean
  partMensuelle: number
  quartierId: number
  misAJourLe: string
}

/** Annonce affichée dans le détail (publique, ou aperçu pour son auteur). */
export interface AnnonceDetail {
  id: number
  auteurId: string
  titre: string
  description: string
  type: TypeAnnonce
  statut: StatutAnnonce
  motifRefus: string | null
  nbPlaces: number
  partMensuelle: number
  loyerTotal: number | null
  chargesIncluses: boolean
  montantCharges: number | null
  quartierId: number
  universiteId: number | null
  disponibleLe: string | null
  dureeMin: number | null
  dureeMax: number | null
  contactWhatsapp: boolean
  contactAppel: boolean
  preferenceGenre: PreferenceGenre
  ageMin: number | null
  ageMax: number | null
  etudiantsUniquement: boolean
  precision: PrecisionPosition
  latitude: number | null
  longitude: number | null
  zoneRayonM: number
  distanceUniversiteM: number | null
  equipements: string[]
  regles: string[]
  taches: { libelle: string; frequence: FrequenceTache; repartition: RepartitionTache }[]
  photos: string[]
}

export interface ContactAnnonce {
  telephone: string | null
  whatsapp: string | null
}
