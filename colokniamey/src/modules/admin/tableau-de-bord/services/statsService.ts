// Seul endroit du sous-module « tableau de bord » (A1) qui appelle Supabase. Chaque fonction SQL revérifie le rôle :
// stats_moderation pour tout admin, les autres pour le super-admin seulement (RGA27). Ce sont des agrégats : aucune
// donnée personnelle (RGA18).
import { supabase } from '@/core/supabase'
import { messageErreur } from '../../services/adminService'

export type Periode = 7 | 30 | 90
export const PERIODES: Periode[] = [7, 30, 90]

const nombre = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0))
const objet = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const liste = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(objet) : [])
const dictionnaire = (v: unknown): Record<string, number> => Object.fromEntries(Object.entries(objet(v)).map(([k, x]) => [k, nombre(x)]))

export interface StatsUtilisateurs {
  total: number
  parRole: Record<string, number>
  parStatut: Record<string, number>
  inscriptions: { jour: string; etudiant: number; proprietaire: number }[]
  nouveaux: number
  nouveauxPrecedente: number
}
export interface StatsAnnonces {
  total: number
  parStatut: Record<string, number>
  parType: Record<string, number>
  parQuartier: { quartier: string; annonces: number }[]
  delaiMoyenHeures: number | null
  publiees: number
  publieesPrecedente: number
}
export interface StatsVisites {
  parJour: { jour: string; visites: number; sessions: number }[]
  aujourdhui: { visites: number; sessions: number }
  hier: { visites: number; sessions: number }
  pages: { chemin: string; visites: number }[]
  appareils: Record<string, number>
}
export interface StatsModeration {
  annoncesEnAttente: number
  annonceLaPlusAncienne: string | null
  prochaineAnnonce: { id: number; titre: string } | null
  photosEnAttente: number
  photoLaPlusAncienne: string | null
  contenusEnAttente: number
  signalementsNouveaux: number
  signalementsEnCours: number
  signalementLePlusAncien: string | null
  identitesEnAttente: number
  parJour: { jour: string; recues: number; traitees: number }[]
}
export interface StatsErreurs {
  ouvertes: number
  nouvelles24h: number
  occurrences24h: number
}

export async function lireStatsUtilisateurs(jours: Periode): Promise<StatsUtilisateurs> {
  const { data, error } = await supabase.rpc('stats_utilisateurs', { p_jours: jours })
  if (error) throw new Error(messageErreur(error))
  const j = objet(data)
  return {
    total: nombre(j.total), parRole: dictionnaire(j.par_role), parStatut: dictionnaire(j.par_statut),
    inscriptions: liste(j.inscriptions).map((x) => ({ jour: String(x.jour), etudiant: nombre(x.etudiant), proprietaire: nombre(x.proprietaire) })),
    nouveaux: nombre(j.nouveaux_periode), nouveauxPrecedente: nombre(j.nouveaux_periode_precedente),
  }
}

export async function lireStatsAnnonces(jours: Periode): Promise<StatsAnnonces> {
  const { data, error } = await supabase.rpc('stats_annonces', { p_jours: jours })
  if (error) throw new Error(messageErreur(error))
  const j = objet(data)
  return {
    total: nombre(j.total), parStatut: dictionnaire(j.par_statut), parType: dictionnaire(j.par_type),
    parQuartier: liste(j.par_quartier).map((x) => ({ quartier: String(x.quartier), annonces: nombre(x.annonces) })),
    delaiMoyenHeures: j.delai_moyen_validation_heures === null || j.delai_moyen_validation_heures === undefined ? null : nombre(j.delai_moyen_validation_heures),
    publiees: nombre(j.publiees_periode), publieesPrecedente: nombre(j.publiees_periode_precedente),
  }
}

export async function lireStatsVisites(jours: Periode): Promise<StatsVisites> {
  const { data, error } = await supabase.rpc('stats_visites', { p_jours: jours })
  if (error) throw new Error(messageErreur(error))
  const j = objet(data)
  const duo = (v: unknown) => ({ visites: nombre(objet(v).visites), sessions: nombre(objet(v).sessions) })
  return {
    parJour: liste(j.par_jour).map((x) => ({ jour: String(x.jour), visites: nombre(x.visites), sessions: nombre(x.sessions) })),
    aujourdhui: duo(j.aujourdhui), hier: duo(j.hier),
    pages: liste(j.pages).map((x) => ({ chemin: String(x.chemin), visites: nombre(x.visites) })),
    appareils: dictionnaire(j.appareils),
  }
}

export async function lireStatsModeration(jours: Periode): Promise<StatsModeration> {
  const { data, error } = await supabase.rpc('stats_moderation', { p_jours: jours })
  if (error) throw new Error(messageErreur(error))
  const j = objet(data)
  const prochaine = j.prochaine_annonce ? objet(j.prochaine_annonce) : null
  const date = (v: unknown): string | null => (typeof v === 'string' ? v : null)
  return {
    annoncesEnAttente: nombre(j.annonces_en_attente), annonceLaPlusAncienne: date(j.annonce_la_plus_ancienne),
    prochaineAnnonce: prochaine ? { id: nombre(prochaine.id), titre: String(prochaine.titre) } : null,
    photosEnAttente: nombre(j.photos_en_attente), photoLaPlusAncienne: date(j.photo_la_plus_ancienne),
    contenusEnAttente: nombre(j.contenus_en_attente), signalementsNouveaux: nombre(j.signalements_nouveaux),
    signalementsEnCours: nombre(j.signalements_en_cours), signalementLePlusAncien: date(j.signalement_le_plus_ancien),
    identitesEnAttente: nombre(j.identites_en_attente),
    parJour: liste(j.par_jour).map((x) => ({ jour: String(x.jour), recues: nombre(x.recues), traitees: nombre(x.traitees) })),
  }
}

export async function lireStatsErreurs(): Promise<StatsErreurs> {
  const { data, error } = await supabase.rpc('stats_erreurs')
  if (error) throw new Error(messageErreur(error))
  const j = objet(data)
  return { ouvertes: nombre(j.ouvertes), nouvelles24h: nombre(j.nouvelles_24h), occurrences24h: nombre(j.occurrences_24h) }
}

/** Libellé court d'un jour « 2026-10-09 » : « 9 oct. ». */
export function libelleJour(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Ancienneté lisible : « 3 h », « 2 jours ». */
export function anciennete(date: string | null): string {
  if (!date) return '-'
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`
  return `${Math.floor(minutes / 1440)} jour(s)`
}
