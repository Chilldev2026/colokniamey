// Seul endroit du module M4 qui appelle Supabase.
// RG23 : la colonne « position » n'est lisible par personne ; on liste donc les colonnes (jamais « select * »)
// et l'auteur relit son point exact par position_annonce(). Le public lit la vue annonces_publiques.
// Les exceptions de la base (code P0001) sont déjà en français : on les montre, les autres restent génériques.

import { supabase } from '@/core/supabase'
import { controlerTexte, messageErreurContenu } from '@/modules/securite'
import { lireEntier } from '../validation'
import type {
  AnnonceDetail,
  AnnonceResume,
  ContactAnnonce,
  FormulaireAnnonce,
  FrequenceTache,
  LigneRegle,
  LigneTache,
  PhotoAnnonceVue,
  PreferenceGenre,
  PrecisionPosition,
  RepartitionTache,
  StatutAnnonce,
  TypeAnnonce,
} from '../types'

const ECHEC_LECTURE = 'Impossible de charger l\'annonce. Réessaie.'

// Colonnes lisibles de la table annonces (toutes sauf « position »)
const COLONNES_AUTEUR =
  'id, auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, charges_incluses, montant_charges_fcfa, quartier_id, universite_proche_id, disponible_le, duree_min_mois, duree_max_mois, contact_whatsapp, contact_appel, preference_genre, age_min, age_max, etudiants_uniquement, statut, motif_refus, en_revue, precision_position, updated_at'

function nombreOuNull(valeur: string): number | null {
  return valeur.trim() === '' ? null : lireEntier(valeur)
}

/** Les points s'écrivent « longitude latitude » en EWKT (format PostGIS). */
function versEwkt(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`
}

function typeAnnonce(v: string): TypeAnnonce {
  return v === 'chambre' || v === 'studio' || v === 'appartement' ? v : 'place_colocation'
}
function statutAnnonce(v: string): StatutAnnonce {
  return v === 'en_attente' || v === 'publiee' || v === 'refusee' || v === 'archivee' ? v : 'brouillon'
}
function genre(v: string): PreferenceGenre {
  return v === 'femme' || v === 'homme' ? v : 'indifferent'
}
function precision(v: string): PrecisionPosition {
  return v === 'exacte' ? 'exacte' : 'approximative'
}

// --- Référentiel de l'annonce ---

export async function listerEquipements(): Promise<{ id: number; nom: string }[]> {
  const { data, error } = await supabase.from('equipements').select('id, nom').eq('actif', true).order('ordre').order('nom')
  if (error) throw new Error('Impossible de charger la liste des équipements.')
  return data
}

// --- Mes annonces ---

export async function listerMesAnnonces(): Promise<AnnonceResume[]> {
  const { data, error } = await supabase
    .from('annonces')
    .select('id, titre, type, statut, motif_refus, en_revue, part_mensuelle_fcfa, quartier_id, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw new Error('Impossible de charger tes annonces.')
  return data.map((a) => ({
    id: a.id,
    titre: a.titre,
    type: typeAnnonce(a.type),
    statut: statutAnnonce(a.statut),
    motifRefus: a.motif_refus,
    enRevue: a.en_revue,
    partMensuelle: a.part_mensuelle_fcfa,
    quartierId: a.quartier_id,
    misAJourLe: a.updated_at,
  }))
}

/** Annonce de l'auteur, prête à être éditée (point exact compris, par position_annonce). */
export async function lireAnnoncePourEdition(id: number): Promise<{ formulaire: FormulaireAnnonce; statut: StatutAnnonce; motifRefus: string | null; enRevue: boolean } | null> {
  const [annonce, equipements, regles, taches, position] = await Promise.all([
    supabase.from('annonces').select(COLONNES_AUTEUR).eq('id', id).maybeSingle(),
    supabase.from('annonce_equipements').select('equipement_id').eq('annonce_id', id),
    supabase.from('regles_annonce').select('id, texte').eq('annonce_id', id).order('ordre'),
    supabase.from('taches_annonce').select('id, libelle, frequence, repartition').eq('annonce_id', id).order('ordre'),
    supabase.rpc('position_annonce', { p_annonce_id: id }),
  ])
  if (annonce.error || equipements.error || regles.error || taches.error || position.error) throw new Error(ECHEC_LECTURE)
  const a = annonce.data
  if (!a) return null
  const p = position.data[0]
  return {
    statut: statutAnnonce(a.statut),
    motifRefus: a.motif_refus,
    enRevue: a.en_revue,
    formulaire: {
      titre: a.titre,
      description: a.description,
      type: typeAnnonce(a.type),
      nbPlaces: String(a.nb_places),
      partMensuelle: String(a.part_mensuelle_fcfa),
      loyerTotal: a.loyer_total_fcfa === null ? '' : String(a.loyer_total_fcfa),
      chargesIncluses: a.charges_incluses,
      montantCharges: a.montant_charges_fcfa === null ? '' : String(a.montant_charges_fcfa),
      quartierId: String(a.quartier_id),
      universiteId: a.universite_proche_id === null ? '' : String(a.universite_proche_id),
      disponibleLe: a.disponible_le ?? '',
      equipementIds: equipements.data.map((e) => e.equipement_id),
      regles: regles.data.map((r) => ({ id: r.id, texte: r.texte })),
      taches: taches.data.map((t) => ({ id: t.id, libelle: t.libelle, frequence: frequence(t.frequence), repartition: repartition(t.repartition) })),
      position: p ? { latitude: p.latitude, longitude: p.longitude } : null,
      precision: precision(a.precision_position),
      dureeMin: a.duree_min_mois === null ? '' : String(a.duree_min_mois),
      dureeMax: a.duree_max_mois === null ? '' : String(a.duree_max_mois),
      contactWhatsapp: a.contact_whatsapp,
      contactAppel: a.contact_appel,
      preferenceGenre: genre(a.preference_genre),
      ageMin: a.age_min === null ? '' : String(a.age_min),
      ageMax: a.age_max === null ? '' : String(a.age_max),
      etudiantsUniquement: a.etudiants_uniquement,
    },
  }
}

function frequence(v: string): FrequenceTache {
  return v === 'quotidienne' || v === 'mensuelle' ? v : 'hebdomadaire'
}
function repartition(v: string): RepartitionTache {
  return v === 'fixe' || v === 'a_discuter' ? v : 'tour_de_role'
}

/**
 * RG45, RG47 : demande à la base si les textes passeraient, ce qui journalise un blocage. Le déclencheur de la
 * table reste la vraie protection ; ce contrôle sert à prévenir avant l'enregistrement.
 */
async function verifierTextes(textes: string[]): Promise<void> {
  for (const texte of textes) {
    if (texte.trim() === '') continue
    if ((await controlerTexte(texte, 'public')) === 'bloque') {
      throw new Error('Ce texte ne respecte pas les règles de ColokNiamey. Modifie-le et réessaie.')
    }
  }
}

/** Colonnes de l'étape « Logement, prix, colocataire et contact » (sans la position). */
function colonnesAnnonce(f: FormulaireAnnonce) {
  return {
    titre: f.titre.trim(),
    description: f.description.trim(),
    type: f.type,
    nb_places: lireEntier(f.nbPlaces) ?? 1,
    part_mensuelle_fcfa: lireEntier(f.partMensuelle) ?? 0,
    loyer_total_fcfa: nombreOuNull(f.loyerTotal),
    charges_incluses: f.chargesIncluses,
    montant_charges_fcfa: f.chargesIncluses ? null : nombreOuNull(f.montantCharges),
    quartier_id: Number(f.quartierId),
    universite_proche_id: f.universiteId === '' ? null : Number(f.universiteId),
    disponible_le: f.disponibleLe === '' ? null : f.disponibleLe,
    duree_min_mois: nombreOuNull(f.dureeMin),
    duree_max_mois: nombreOuNull(f.dureeMax),
    contact_whatsapp: f.contactWhatsapp,
    contact_appel: f.contactAppel,
    preference_genre: f.preferenceGenre,
    age_min: nombreOuNull(f.ageMin),
    age_max: nombreOuNull(f.ageMax),
    etudiants_uniquement: f.etudiantsUniquement,
    precision_position: f.precision,
  }
}

/** Crée le brouillon (premier enregistrement) et renvoie son identifiant. */
export async function creerAnnonce(auteurId: string, f: FormulaireAnnonce): Promise<number> {
  await verifierTextes([f.titre, f.description])
  const { data, error } = await supabase
    .from('annonces')
    .insert({ auteur_id: auteurId, ...colonnesAnnonce(f), ...(f.position ? { position: versEwkt(f.position.latitude, f.position.longitude) } : {}) })
    .select('id')
    .single()
  if (error) throw new Error(messageErreurContenu(error))
  return data.id
}

/** Enregistre l'annonce ; la position n'est envoyée que si elle a changé (RG21, RG22). */
export async function modifierAnnonce(id: number, f: FormulaireAnnonce, positionModifiee: boolean, textesModifies: string[]): Promise<void> {
  await verifierTextes(textesModifies)
  const { error } = await supabase
    .from('annonces')
    .update({
      ...colonnesAnnonce(f),
      ...(positionModifiee && f.position ? { position: versEwkt(f.position.latitude, f.position.longitude) } : {}),
    })
    .eq('id', id)
  if (error) throw new Error(messageErreurContenu(error))
}

// --- Équipements, règles, tâches : on n'écrit que les différences ---

export async function synchroniserEquipements(id: number, voulus: number[], actuels: number[]): Promise<void> {
  const aAjouter = voulus.filter((e) => !actuels.includes(e))
  const aRetirer = actuels.filter((e) => !voulus.includes(e))
  if (aRetirer.length > 0) {
    const { error } = await supabase.from('annonce_equipements').delete().eq('annonce_id', id).in('equipement_id', aRetirer)
    if (error) throw new Error(messageErreurContenu(error))
  }
  if (aAjouter.length > 0) {
    const { error } = await supabase.from('annonce_equipements').insert(aAjouter.map((equipement_id) => ({ annonce_id: id, equipement_id })))
    if (error) throw new Error(messageErreurContenu(error))
  }
}

export async function synchroniserRegles(id: number, lignes: LigneRegle[], anciennes: LigneRegle[]): Promise<LigneRegle[]> {
  const voulues = lignes.map((l) => ({ ...l, texte: l.texte.trim() })).filter((l) => l.texte !== '')
  await verifierTextes(voulues.filter((l) => !anciennes.some((a) => a.id === l.id && a.texte === l.texte)).map((l) => l.texte))
  const aRetirer = anciennes.filter((a) => a.id !== undefined && !voulues.some((l) => l.id === a.id)).map((a) => a.id as number)
  if (aRetirer.length > 0) {
    const { error } = await supabase.from('regles_annonce').delete().in('id', aRetirer)
    if (error) throw new Error(messageErreurContenu(error))
  }
  for (const [index, ligne] of voulues.entries()) {
    const ancienne = anciennes.find((a) => a.id === ligne.id)
    if (ligne.id !== undefined && ancienne) {
      if (ancienne.texte !== ligne.texte || voulues.indexOf(ligne) !== anciennes.indexOf(ancienne)) {
        const { error } = await supabase.from('regles_annonce').update({ texte: ligne.texte, ordre: index + 1 }).eq('id', ligne.id)
        if (error) throw new Error(messageErreurContenu(error))
      }
    } else {
      const { error } = await supabase.from('regles_annonce').insert({ annonce_id: id, texte: ligne.texte, ordre: index + 1 })
      if (error) throw new Error(messageErreurContenu(error))
    }
  }
  const { data, error } = await supabase.from('regles_annonce').select('id, texte').eq('annonce_id', id).order('ordre')
  if (error) throw new Error(ECHEC_LECTURE)
  return data
}

export async function synchroniserTaches(id: number, lignes: LigneTache[], anciennes: LigneTache[]): Promise<LigneTache[]> {
  const voulues = lignes.map((l) => ({ ...l, libelle: l.libelle.trim() })).filter((l) => l.libelle !== '')
  await verifierTextes(voulues.filter((l) => !anciennes.some((a) => a.id === l.id && a.libelle === l.libelle)).map((l) => l.libelle))
  const aRetirer = anciennes.filter((a) => a.id !== undefined && !voulues.some((l) => l.id === a.id)).map((a) => a.id as number)
  if (aRetirer.length > 0) {
    const { error } = await supabase.from('taches_annonce').delete().in('id', aRetirer)
    if (error) throw new Error(messageErreurContenu(error))
  }
  for (const [index, ligne] of voulues.entries()) {
    const ancienne = anciennes.find((a) => a.id === ligne.id)
    const valeurs = { libelle: ligne.libelle, frequence: ligne.frequence, repartition: ligne.repartition, ordre: index + 1 }
    if (ligne.id !== undefined && ancienne) {
      const change =
        ancienne.libelle !== ligne.libelle || ancienne.frequence !== ligne.frequence ||
        ancienne.repartition !== ligne.repartition || voulues.indexOf(ligne) !== anciennes.indexOf(ancienne)
      if (change) {
        const { error } = await supabase.from('taches_annonce').update(valeurs).eq('id', ligne.id)
        if (error) throw new Error(messageErreurContenu(error))
      }
    } else {
      const { error } = await supabase.from('taches_annonce').insert({ annonce_id: id, ...valeurs })
      if (error) throw new Error(messageErreurContenu(error))
    }
  }
  const { data, error } = await supabase.from('taches_annonce').select('id, libelle, frequence, repartition').eq('annonce_id', id).order('ordre')
  if (error) throw new Error(ECHEC_LECTURE)
  return data.map((t) => ({ id: t.id, libelle: t.libelle, frequence: frequence(t.frequence), repartition: repartition(t.repartition) }))
}

// --- Photos (RG18, RG48 à RG50) : l'envoi lui-même passe par EnvoiPhoto, jamais par ce service ---

export async function listerPhotosAnnonce(id: number): Promise<PhotoAnnonceVue[]> {
  const { data: liens, error } = await supabase.from('photos_annonces').select('id, photo_id, ordre').eq('annonce_id', id).order('ordre')
  if (error) throw new Error('Impossible de charger les photos.')
  if (liens.length === 0) return []
  const { data: photos, error: erreurPhotos } = await supabase
    .from('photos')
    .select('id, chemin, statut, motif')
    .in('id', liens.map((l) => l.photo_id))
  if (erreurPhotos) throw new Error('Impossible de charger les photos.')
  const vues: PhotoAnnonceVue[] = []
  for (const l of liens) {
    const p = photos.find((x) => x.id === l.photo_id)
    if (!p) continue
    vues.push({
      id: l.id, photoId: l.photo_id, ordre: l.ordre, chemin: p.chemin, motif: p.motif,
      statut: p.statut === 'validee' || p.statut === 'refusee' ? p.statut : 'en_attente',
    })
  }
  return vues
}

export async function ajouterPhoto(annonceId: number, photoId: number): Promise<void> {
  const { error } = await supabase.from('photos_annonces').insert({ annonce_id: annonceId, photo_id: photoId })
  if (error) throw new Error(messageErreurContenu(error))
}

export async function retirerPhoto(lienId: number): Promise<void> {
  const { error } = await supabase.from('photos_annonces').delete().eq('id', lienId)
  if (error) throw new Error(messageErreurContenu(error))
}

export async function ordonnerPhotos(liensDansLOrdre: number[]): Promise<void> {
  for (const [index, id] of liensDansLOrdre.entries()) {
    const { error } = await supabase.from('photos_annonces').update({ ordre: index + 1 }).eq('id', id)
    if (error) throw new Error(messageErreurContenu(error))
  }
}

/** Photo validée : adresse publique. Photo en attente : adresse temporaire, visible seulement par son auteur. */
export function urlPhotoPublique(chemin: string): string {
  return supabase.storage.from('photos_publiques').getPublicUrl(chemin).data.publicUrl
}

export async function urlPhotoEnAttente(chemin: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('photos_en_attente').createSignedUrl(chemin, 3600)
  return error ? null : data.signedUrl
}

// --- Cycle de vie ---

export async function soumettreAnnonce(id: number): Promise<StatutAnnonce> {
  const { data, error } = await supabase.rpc('soumettre_annonce', { p_annonce_id: id })
  if (error) throw new Error(messageErreurContenu(error))
  return statutAnnonce(String(data))
}

export async function archiverAnnonce(id: number): Promise<void> {
  const { error } = await supabase.rpc('archiver_annonce', { p_annonce_id: id })
  if (error) throw new Error(messageErreurContenu(error))
}

export async function rouvrirAnnonce(id: number): Promise<void> {
  const { error } = await supabase.rpc('rouvrir_annonce', { p_annonce_id: id })
  if (error) throw new Error(messageErreurContenu(error))
}

export async function supprimerAnnonce(id: number): Promise<void> {
  const { error } = await supabase.from('annonces').delete().eq('id', id)
  if (error) throw new Error(messageErreurContenu(error))
}

// --- Lecture publique (RG24) ---

/**
 * Détail d'une annonce : la vue publique d'abord ; à défaut, l'annonce de l'auteur (aperçu, motif de refus).
 * Renvoie null si elle n'existe pas ou n'est pas visible par cette personne.
 */
export async function lireAnnonceDetail(id: number): Promise<AnnonceDetail | null> {
  const publique = await supabase.from('annonces_publiques').select('*').eq('id', id).maybeSingle()
  if (publique.error) throw new Error(ECHEC_LECTURE)
  let base: Omit<AnnonceDetail, 'equipements' | 'regles' | 'taches' | 'photos'> | null = null

  if (publique.data && publique.data.id !== null) {
    const a = publique.data
    base = {
      id: a.id as number,
      auteurId: String(a.auteur_id),
      titre: String(a.titre),
      description: String(a.description),
      type: typeAnnonce(String(a.type)),
      statut: 'publiee',
      motifRefus: null,
      nbPlaces: Number(a.nb_places),
      partMensuelle: Number(a.part_mensuelle_fcfa),
      loyerTotal: a.loyer_total_fcfa ?? null,
      chargesIncluses: a.charges_incluses === true,
      montantCharges: a.montant_charges_fcfa ?? null,
      quartierId: Number(a.quartier_id),
      universiteId: a.universite_proche_id ?? null,
      disponibleLe: a.disponible_le ?? null,
      dureeMin: a.duree_min_mois ?? null,
      dureeMax: a.duree_max_mois ?? null,
      contactWhatsapp: a.contact_whatsapp === true,
      contactAppel: a.contact_appel === true,
      preferenceGenre: genre(String(a.preference_genre)),
      ageMin: a.age_min ?? null,
      ageMax: a.age_max ?? null,
      etudiantsUniquement: a.etudiants_uniquement === true,
      precision: precision(String(a.precision_position)),
      latitude: a.latitude ?? null,
      longitude: a.longitude ?? null,
      zoneRayonM: Number(a.zone_rayon_m ?? 0),
      distanceUniversiteM: a.distance_universite_m ?? null,
    }
  } else {
    // Annonce non publiée : seul son auteur (ou un admin) la lit, avec la position publique calculée par la base
    const { data: a, error } = await supabase.from('annonces').select(COLONNES_AUTEUR).eq('id', id).maybeSingle()
    if (error) throw new Error(ECHEC_LECTURE)
    if (!a) return null
    base = {
      id: a.id, auteurId: a.auteur_id, titre: a.titre, description: a.description, type: typeAnnonce(a.type),
      statut: statutAnnonce(a.statut), motifRefus: a.motif_refus, nbPlaces: a.nb_places,
      partMensuelle: a.part_mensuelle_fcfa, loyerTotal: a.loyer_total_fcfa, chargesIncluses: a.charges_incluses,
      montantCharges: a.montant_charges_fcfa, quartierId: a.quartier_id, universiteId: a.universite_proche_id,
      disponibleLe: a.disponible_le, dureeMin: a.duree_min_mois, dureeMax: a.duree_max_mois,
      contactWhatsapp: a.contact_whatsapp, contactAppel: a.contact_appel, preferenceGenre: genre(a.preference_genre),
      ageMin: a.age_min, ageMax: a.age_max, etudiantsUniquement: a.etudiants_uniquement,
      precision: precision(a.precision_position), latitude: null, longitude: null,
      zoneRayonM: a.precision_position === 'exacte' ? 0 : 150, distanceUniversiteM: null,
    }
    const p = await supabase.rpc('position_annonce', { p_annonce_id: id })
    if (!p.error && p.data[0]) {
      base.latitude = p.data[0].latitude
      base.longitude = p.data[0].longitude
    }
  }

  const [equipements, regles, taches, photos] = await Promise.all([
    supabase.from('annonce_equipements').select('equipements(nom)').eq('annonce_id', id),
    supabase.from('regles_annonce').select('texte').eq('annonce_id', id).order('ordre'),
    supabase.from('taches_annonce').select('libelle, frequence, repartition').eq('annonce_id', id).order('ordre'),
    supabase.rpc('photos_annonce', { p_annonce_id: id }),
  ])
  if (equipements.error || regles.error || taches.error || photos.error) throw new Error(ECHEC_LECTURE)

  const detail: AnnonceDetail = {
    ...base,
    equipements: equipements.data.flatMap((e) => (e.equipements ? [e.equipements.nom] : [])),
    regles: regles.data.map((r) => r.texte),
    taches: taches.data.map((t) => ({ libelle: t.libelle, frequence: frequence(t.frequence), repartition: repartition(t.repartition) })),
    photos: photos.data.map((p) => urlPhotoPublique(p.chemin)),
  }
  return detail
}

/** RG32 : numéros de contact, pour les utilisateurs connectés seulement (30 consultations par jour). */
export async function lireContactAnnonce(id: number): Promise<ContactAnnonce> {
  const { data, error } = await supabase.rpc('contact_annonce', { p_annonce_id: id })
  if (error) throw new Error(messageErreurContenu(error))
  const l = data[0] as { telephone: string | null; whatsapp: string | null } | undefined
  return { telephone: l?.telephone ?? null, whatsapp: l?.whatsapp ?? null }
}
