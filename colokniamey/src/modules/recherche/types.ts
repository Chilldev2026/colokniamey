// Types et fonctions pures du module M5 (recherche, carte, favoris) : filtres, lien dans l'URL, regroupement des marqueurs.

export type TriRecherche = 'recent' | 'loyer_asc' | 'loyer_desc'
export type TypeFiltre = '' | 'chambre' | 'studio' | 'appartement' | 'place_colocation'

/** Filtres de la recherche. Les valeurs vides signifient « pas de filtre ». Tout est du texte tant qu'on saisit. */
export interface FiltresRecherche {
  texte: string
  quartierId: string
  universiteId: string
  /** Université de référence pour la distance (RG25) ; elle doit avoir une position. */
  universiteRefId: string
  type: TypeFiltre
  loyerMin: string
  loyerMax: string
  disponibleAvant: string
  equipements: number[]
  dureeMois: string
  compatible: boolean
  tri: TriRecherche
}

export function filtresVides(): FiltresRecherche {
  return {
    texte: '', quartierId: '', universiteId: '', universiteRefId: '', type: '', loyerMin: '', loyerMax: '',
    disponibleAvant: '', equipements: [], dureeMois: '', compatible: false, tri: 'recent',
  }
}

export const LIBELLES_TYPE: Record<string, string> = {
  chambre: 'Chambre',
  studio: 'Studio',
  appartement: 'Appartement',
  place_colocation: 'Place en colocation',
}
export const LIBELLES_TRI: Record<TriRecherche, string> = {
  recent: 'Plus récentes',
  loyer_asc: 'Loyer croissant',
  loyer_desc: 'Loyer décroissant',
}

function entier(valeur: string): number | null {
  const v = valeur.replace(/\s/g, '')
  return /^\d+$/.test(v) ? Number(v) : null
}

/** Filtres envoyés à la base (jsonb). Les valeurs invalides sont ignorées plutôt que d'échouer. */
export function versFiltresBase(f: FiltresRecherche, villeId?: number): Record<string, unknown> {
  const j: Record<string, unknown> = {}
  if (villeId !== undefined) j.ville_id = villeId
  if (f.texte.trim() !== '') j.texte = f.texte.trim().slice(0, 200)
  if (f.quartierId !== '') j.quartier_id = Number(f.quartierId)
  if (f.universiteId !== '') j.universite_id = Number(f.universiteId)
  if (f.universiteRefId !== '') j.universite_ref_id = Number(f.universiteRefId)
  if (f.type !== '') j.type = f.type
  const min = entier(f.loyerMin)
  const max = entier(f.loyerMax)
  if (min !== null) j.loyer_min = min
  if (max !== null) j.loyer_max = max
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.disponibleAvant)) j.disponible_avant = f.disponibleAvant
  if (f.equipements.length > 0) j.equipements = f.equipements
  const duree = entier(f.dureeMois)
  if (duree !== null && duree > 0) j.duree_mois = duree
  if (f.compatible) j.compatible = true
  return j
}

/** Les filtres vivent dans l'URL : un lien partagé rouvre la même recherche. */
export function versRequeteUrl(f: FiltresRecherche, vue: 'liste' | 'carte'): Record<string, string> {
  const q: Record<string, string> = {}
  if (f.texte.trim() !== '') q.texte = f.texte.trim()
  if (f.quartierId !== '') q.quartier = f.quartierId
  if (f.universiteId !== '') q.universite = f.universiteId
  if (f.universiteRefId !== '') q.reference = f.universiteRefId
  if (f.type !== '') q.type = f.type
  if (f.loyerMin !== '') q.min = f.loyerMin
  if (f.loyerMax !== '') q.max = f.loyerMax
  if (f.disponibleAvant !== '') q.dispo = f.disponibleAvant
  if (f.equipements.length > 0) q.equipements = f.equipements.join(',')
  if (f.dureeMois !== '') q.duree = f.dureeMois
  if (f.compatible) q.compatible = '1'
  if (f.tri !== 'recent') q.tri = f.tri
  if (vue === 'carte') q.vue = 'carte'
  return q
}

function premier(v: unknown): string {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : ''
}

export function depuisRequeteUrl(requete: Record<string, unknown>): { filtres: FiltresRecherche; vue: 'liste' | 'carte' } {
  const f = filtresVides()
  f.texte = premier(requete.texte).slice(0, 200)
  f.quartierId = /^\d+$/.test(premier(requete.quartier)) ? premier(requete.quartier) : ''
  f.universiteId = /^\d+$/.test(premier(requete.universite)) ? premier(requete.universite) : ''
  f.universiteRefId = /^\d+$/.test(premier(requete.reference)) ? premier(requete.reference) : ''
  const type = premier(requete.type)
  f.type = type === 'chambre' || type === 'studio' || type === 'appartement' || type === 'place_colocation' ? type : ''
  f.loyerMin = /^\d+$/.test(premier(requete.min)) ? premier(requete.min) : ''
  f.loyerMax = /^\d+$/.test(premier(requete.max)) ? premier(requete.max) : ''
  f.disponibleAvant = /^\d{4}-\d{2}-\d{2}$/.test(premier(requete.dispo)) ? premier(requete.dispo) : ''
  f.equipements = premier(requete.equipements).split(',').filter((e) => /^\d+$/.test(e)).map(Number)
  f.dureeMois = /^\d+$/.test(premier(requete.duree)) ? premier(requete.duree) : ''
  f.compatible = premier(requete.compatible) === '1'
  const tri = premier(requete.tri)
  f.tri = tri === 'loyer_asc' || tri === 'loyer_desc' ? tri : 'recent'
  return { filtres: f, vue: premier(requete.vue) === 'carte' ? 'carte' : 'liste' }
}

/** Nombre de filtres actifs (hors tri) : affiché sur le bouton « Filtres ». */
export function compterFiltres(f: FiltresRecherche): number {
  return [f.quartierId, f.universiteId, f.type, f.loyerMin, f.loyerMax, f.disponibleAvant, f.dureeMois].filter((v) => v !== '').length
    + (f.equipements.length > 0 ? 1 : 0) + (f.compatible ? 1 : 0)
}

// --- Carte ---

export interface PointCarte {
  id: number
  latitude: number
  longitude: number
}

export interface GroupeMarqueurs<T extends PointCarte> {
  latitude: number
  longitude: number
  points: T[]
}

/**
 * Regroupe les marqueurs trop proches pour rester lisibles : on découpe la carte en cases dont la taille dépend du zoom
 * (environ 60 pixels), et les points d'une même case forment un groupe. Au zoom maximum, plus de regroupement.
 */
export function regrouper<T extends PointCarte>(points: T[], zoom: number, zoomMax = 17): GroupeMarqueurs<T>[] {
  if (zoom >= zoomMax) return points.map((p) => ({ latitude: p.latitude, longitude: p.longitude, points: [p] }))
  // Un pixel vaut 360 / (256 × 2^zoom) degrés ; une case fait 60 pixels
  const taille = (360 / (256 * 2 ** zoom)) * 60
  const cases = new Map<string, T[]>()
  for (const p of points) {
    const cle = `${Math.floor(p.latitude / taille)}:${Math.floor(p.longitude / taille)}`
    const liste = cases.get(cle)
    if (liste) liste.push(p)
    else cases.set(cle, [p])
  }
  return Array.from(cases.values()).map((liste) => ({
    latitude: liste.reduce((s, p) => s + p.latitude, 0) / liste.length,
    longitude: liste.reduce((s, p) => s + p.longitude, 0) / liste.length,
    points: liste,
  }))
}

export function formaterDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1).replace('.', ',')} km` : `${metres} m`
}
