// Seul endroit du sous-module « communiqués » (A4, côté admin) qui appelle Supabase. Création, modification et suppression
// sont limitées aux admins par la RLS ; le niveau « critique » est réservé au super-admin par les politiques d'écriture (RGA28).
import { supabase } from '@/core/supabase'
import type { NiveauCommunique } from '../../../communiques/services/communiquesService'
import { messageErreur } from '../../services/adminService'

export type CibleCommunique = 'tous' | 'etudiants' | 'proprietaires'

export interface CommuniqueAdmin {
  id: number
  titre: string
  message: string
  niveau: NiveauCommunique
  cible: CibleCommunique
  debut: string
  fin: string
}

export interface FormulaireCommunique {
  titre: string
  message: string
  niveau: NiveauCommunique
  cible: CibleCommunique
  /** Date et heure au format du champ datetime-local (« 2026-10-09T08:00 »). */
  debut: string
  fin: string
}

export type EtatCommunique = 'programme' | 'en_cours' | 'termine'

export function etatCommunique(c: Pick<CommuniqueAdmin, 'debut' | 'fin'>, maintenant = Date.now()): EtatCommunique {
  if (new Date(c.debut).getTime() > maintenant) return 'programme'
  return new Date(c.fin).getTime() > maintenant ? 'en_cours' : 'termine'
}

/** « 2026-10-09T08:00 » (heure locale du champ) → date ISO UTC pour la base. */
export function versIso(local: string): string {
  return new Date(local).toISOString()
}
/** Date ISO → valeur d'un champ datetime-local (heure locale). */
export function versChampLocal(iso: string): string {
  const d = new Date(iso)
  const decale = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return decale.toISOString().slice(0, 16)
}

/** Contrôle de saisie (la base le refait : fin après début, longueurs). */
export function validerCommunique(f: FormulaireCommunique): Record<string, string> {
  const e: Record<string, string> = {}
  if (f.titre.trim().length < 3 || f.titre.trim().length > 100) e.titre = 'Le titre fait entre 3 et 100 caractères.'
  if (f.message.trim().length < 3 || f.message.trim().length > 500) e.message = 'Le message fait entre 3 et 500 caractères.'
  if (!f.debut || Number.isNaN(new Date(f.debut).getTime())) e.debut = 'Indique le début.'
  if (!f.fin || Number.isNaN(new Date(f.fin).getTime())) e.fin = 'Indique la fin.'
  else if (!e.debut && new Date(f.fin).getTime() <= new Date(f.debut).getTime()) e.fin = 'La fin doit être après le début.'
  return e
}

function niveau(v: string): NiveauCommunique {
  return v === 'critique' || v === 'avertissement' ? v : 'information'
}
function cible(v: string): CibleCommunique {
  return v === 'etudiants' || v === 'proprietaires' ? v : 'tous'
}

export async function listerCommuniques(): Promise<CommuniqueAdmin[]> {
  const { data, error } = await supabase.from('communiques').select('id, titre, message, niveau, cible, debut, fin').order('debut', { ascending: false }).limit(200)
  if (error) throw new Error('Impossible de charger les communiqués.')
  return data.map((c) => ({ id: c.id, titre: c.titre, message: c.message, niveau: niveau(c.niveau), cible: cible(c.cible), debut: c.debut, fin: c.fin }))
}

function colonnes(f: FormulaireCommunique) {
  return { titre: f.titre.trim(), message: f.message.trim(), niveau: f.niveau, cible: f.cible, debut: versIso(f.debut), fin: versIso(f.fin) }
}

export async function creerCommunique(f: FormulaireCommunique): Promise<void> {
  const { error } = await supabase.from('communiques').insert(colonnes(f))
  if (error) throw new Error(messageEcriture(error))
}

export async function modifierCommunique(id: number, f: FormulaireCommunique): Promise<void> {
  const { data, error } = await supabase.from('communiques').update(colonnes(f)).eq('id', id).select('id')
  if (error) throw new Error(messageEcriture(error))
  // la RLS ne signale pas une ligne interdite : elle ne la touche pas
  if (data.length === 0) throw new Error('Tu ne peux pas modifier ce communiqué (les communiqués critiques sont réservés au super-admin).')
}

/** Fin anticipée : le communiqué s'arrête maintenant. */
export async function terminerCommunique(id: number): Promise<void> {
  const { data, error } = await supabase.from('communiques').update({ fin: new Date().toISOString() }).eq('id', id).select('id')
  if (error) throw new Error(messageEcriture(error))
  if (data.length === 0) throw new Error('Tu ne peux pas modifier ce communiqué (les communiqués critiques sont réservés au super-admin).')
}

export async function supprimerCommunique(id: number): Promise<void> {
  const { data, error } = await supabase.from('communiques').delete().eq('id', id).select('id')
  if (error) throw new Error(messageEcriture(error))
  if (data.length === 0) throw new Error('Tu ne peux pas supprimer ce communiqué (les communiqués critiques sont réservés au super-admin).')
}

function messageEcriture(erreur: { code?: string; message?: string }): string {
  if (erreur.code === '42501') return 'Action refusée : le niveau « critique » est réservé au super-admin.'
  if (erreur.code === '23514') return 'La fin doit être après le début.'
  return messageErreur(erreur)
}
