// Seul endroit du sous-module « modération » (A3) qui appelle Supabase. Chaque fonction SQL revérifie est_admin()
// (aal2 + session active) ; la fonction réservée au super-admin revérifie est_super_admin() (RGA27).
import { supabase } from '@/core/supabase'
import { messageErreur } from '../../services/adminService'

// --- Annonces ---

export interface AnnonceEnAttente {
  id: number
  titre: string
  type: string
  auteurId: string
  prenom: string
  initialeNom: string
  enRevue: boolean
  depuis: string
}

export interface PhotoApercu {
  id: number
  chemin: string
  statut: string
}

export interface AnnonceAModerer {
  id: number
  titre: string
  description: string
  type: string
  statut: string
  nbPlaces: number
  partMensuelle: number
  loyerTotal: number | null
  chargesIncluses: boolean
  quartier: string
  universite: string | null
  precision: string
  latitude: number | null
  longitude: number | null
  zoneRayonM: number
  enRevue: boolean
  auteur: { id: string; prenom: string; nom: string; role: string; statut: string }
  regles: string[]
  taches: { libelle: string; frequence: string; repartition: string }[]
  equipements: string[]
  photos: PhotoApercu[]
}

export async function listerAnnoncesEnAttente(): Promise<AnnonceEnAttente[]> {
  const { data, error } = await supabase.rpc('liste_annonces_a_valider')
  if (error) throw new Error(messageErreur(error))
  return data.map((a) => ({
    id: a.id, titre: a.titre, type: a.type, auteurId: a.auteur_id, prenom: a.prenom, initialeNom: a.initiale_nom,
    enRevue: a.en_revue, depuis: a.partie_le,
  }))
}

function lire(j: Record<string, unknown>, cle: string): unknown {
  return j[cle]
}
const texte = (v: unknown, defaut = ''): string => (typeof v === 'string' ? v : defaut)
const nombre = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0))
const nombreOuNull = (v: unknown): number | null => (typeof v === 'number' ? v : null)
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export async function lireAnnonceAModerer(id: number): Promise<AnnonceAModerer> {
  const { data, error } = await supabase.rpc('annonce_a_moderer', { p_id: id })
  if (error) throw new Error(messageErreur(error))
  const j = (typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}) as Record<string, unknown>
  const a = lire(j, 'auteur') as Record<string, unknown> | undefined
  return {
    id: nombre(lire(j, 'id')),
    titre: texte(lire(j, 'titre')),
    description: texte(lire(j, 'description')),
    type: texte(lire(j, 'type')),
    statut: texte(lire(j, 'statut')),
    nbPlaces: nombre(lire(j, 'nb_places')),
    partMensuelle: nombre(lire(j, 'part_mensuelle_fcfa')),
    loyerTotal: nombreOuNull(lire(j, 'loyer_total_fcfa')),
    chargesIncluses: lire(j, 'charges_incluses') === true,
    quartier: texte(lire(j, 'quartier')),
    universite: typeof lire(j, 'universite') === 'string' ? texte(lire(j, 'universite')) : null,
    precision: texte(lire(j, 'precision_position')),
    latitude: nombreOuNull(lire(j, 'latitude')),
    longitude: nombreOuNull(lire(j, 'longitude')),
    zoneRayonM: nombre(lire(j, 'zone_rayon_m')),
    enRevue: lire(j, 'en_revue') === true,
    auteur: {
      id: texte(a?.id), prenom: texte(a?.prenom), nom: texte(a?.nom), role: texte(a?.role), statut: texte(a?.statut),
    },
    regles: liste(lire(j, 'regles')).map((r) => texte(r)),
    taches: liste(lire(j, 'taches')).map((t) => {
      const x = (t ?? {}) as Record<string, unknown>
      return { libelle: texte(x.libelle), frequence: texte(x.frequence), repartition: texte(x.repartition) }
    }),
    equipements: liste(lire(j, 'equipements')).map((e) => texte(e)),
    photos: liste(lire(j, 'photos')).map((p) => {
      const x = (p ?? {}) as Record<string, unknown>
      return { id: nombre(x.id), chemin: texte(x.chemin), statut: texte(x.statut) }
    }),
  }
}

export async function validerAnnonce(id: number): Promise<void> {
  const { error } = await supabase.rpc('valider_annonce', { p_id: id })
  if (error) throw new Error(messageErreur(error))
}
export async function refuserAnnonce(id: number, motif: string): Promise<void> {
  const { error } = await supabase.rpc('refuser_annonce', { p_id: id, p_motif: motif })
  if (error) throw new Error(messageErreur(error))
}
export async function retirerAnnonce(id: number, motif: string): Promise<void> {
  const { error } = await supabase.rpc('retirer_annonce', { p_id: id, p_motif: motif })
  if (error) throw new Error(messageErreur(error))
}

/** Aperçu d'une photo : adresse publique si validée, adresse temporaire (10 minutes) du bucket privé sinon. */
export async function urlApercuPhoto(chemin: string, statut: string): Promise<string | null> {
  if (statut === 'validee') return supabase.storage.from('photos_publiques').getPublicUrl(chemin).data.publicUrl
  const { data, error } = await supabase.storage.from('photos_en_attente').createSignedUrl(chemin, 600)
  return error ? null : data.signedUrl
}

// --- Photos ---

export interface PhotoAValider {
  id: number
  usage: string
  chemin: string
  prenom: string
  initialeNom: string
  suspecte: boolean
  creeeLe: string
}

export async function listerPhotosAValider(): Promise<PhotoAValider[]> {
  const { data, error } = await supabase.rpc('liste_photos_a_valider')
  if (error) throw new Error(messageErreur(error))
  return data.map((p) => ({
    id: p.id, usage: p.usage, chemin: p.chemin, prenom: p.prenom, initialeNom: p.initiale_nom, suspecte: p.suspecte, creeeLe: p.created_at,
  }))
}

// --- Contenus en revue et récidives ---

export interface ContenuARevoir {
  id: number
  type: string
  categories: string[]
  prenom: string | null
  creeLe: string
}
export interface Recidive {
  userId: string
  prenom: string
  initialeNom: string
  nombre: number
  dernier: string
}

export async function listerContenus(): Promise<ContenuARevoir[]> {
  const { data, error } = await supabase.rpc('liste_contenus_a_verifier')
  if (error) throw new Error(messageErreur(error))
  return data.map((c) => ({ id: c.id, type: c.type_contenu, categories: c.categories, prenom: c.prenom ?? null, creeLe: c.created_at }))
}

export async function lireContenu(id: number): Promise<{ champ: string; valeur: string }[]> {
  const { data, error } = await supabase.rpc('contenu_a_verifier', { p_id: id })
  if (error) throw new Error(messageErreur(error))
  return liste(data).map((x) => {
    const l = (x ?? {}) as Record<string, unknown>
    return { champ: texte(l.champ), valeur: texte(l.valeur) }
  })
}

export async function deciderContenu(id: number, publier: boolean, motif?: string): Promise<void> {
  const { error } = await supabase.rpc('decider_contenu', { p_id: id, p_publier: publier, ...(motif ? { p_motif: motif } : {}) })
  if (error) throw new Error(messageErreur(error))
}

export async function listerRecidives(): Promise<Recidive[]> {
  const { data, error } = await supabase.rpc('liste_recidives')
  if (error) throw new Error(messageErreur(error))
  return data.map((r) => ({ userId: r.user_id, prenom: r.prenom, initialeNom: r.initiale_nom, nombre: r.nombre, dernier: r.dernier }))
}

// --- Termes sensibles ---

export type CategorieTerme = 'sexuel' | 'haine' | 'terrorisme' | 'violence' | 'menace'
export type NiveauTerme = 'revue' | 'blocage'

export interface TermeSensible {
  id: number
  terme: string
  categorie: string
  niveau: string
  langue: string
  actif: boolean
  valide: boolean
  proposeParMoi: boolean
}

export async function listerTermes(): Promise<TermeSensible[]> {
  const { data, error } = await supabase.rpc('liste_termes')
  if (error) throw new Error(messageErreur(error))
  return data.map((t) => ({
    id: t.id, terme: t.terme, categorie: t.categorie, niveau: t.niveau, langue: t.langue, actif: t.actif, valide: t.valide, proposeParMoi: t.propose_par_moi,
  }))
}

export async function proposerTerme(terme: string, categorie: CategorieTerme, niveau: NiveauTerme, langue: string): Promise<void> {
  const { error } = await supabase.rpc('proposer_terme', { p_terme: terme, p_categorie: categorie, p_niveau: niveau, p_langue: langue })
  if (error) throw new Error(messageErreur(error))
}
export async function validerTerme(id: number): Promise<void> {
  const { error } = await supabase.rpc('valider_terme', { p_id: id })
  if (error) throw new Error(messageErreur(error))
}
export async function modifierTerme(id: number, terme: string, categorie: CategorieTerme, niveau: NiveauTerme, langue: string): Promise<void> {
  const { error } = await supabase.rpc('modifier_terme', { p_id: id, p_terme: terme, p_categorie: categorie, p_niveau: niveau, p_langue: langue })
  if (error) throw new Error(messageErreur(error))
}
export async function definirTermeActif(id: number, actif: boolean): Promise<void> {
  const { error } = await supabase.rpc('definir_terme_actif', { p_id: id, p_actif: actif })
  if (error) throw new Error(messageErreur(error))
}
export async function rejeterTerme(id: number): Promise<void> {
  const { error } = await supabase.rpc('rejeter_terme', { p_id: id })
  if (error) throw new Error(messageErreur(error))
}
