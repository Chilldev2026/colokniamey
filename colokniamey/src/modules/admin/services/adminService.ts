// Seul endroit du module admin (coque, MFA, sessions, files, relances) qui appelle Supabase.
// Les exceptions de nos fonctions SQL (code P0001) sont en français : on les montre telles quelles.

import { supabase } from '@/core/supabase'
import type { EtatFile, FacteurTotp, InscriptionTotp, RelanceRecue } from '../types'

const GENERIQUE = 'Une erreur est survenue. Réessaie dans un moment.'

export function messageErreur(erreur: { code?: string; message?: string } | null | undefined): string {
  if (erreur?.code === 'P0001' && erreur.message) return erreur.message
  return GENERIQUE
}

// --- Double authentification TOTP (RGA04, RGA37) ---

/** Niveau de la session : aal2 une fois le code TOTP vérifié. */
export async function niveauAssurance(): Promise<'aal1' | 'aal2' | null> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return null
  return data.currentLevel === 'aal2' ? 'aal2' : data.currentLevel === 'aal1' ? 'aal1' : null
}

export async function listerFacteurs(): Promise<FacteurTotp[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) throw new Error(GENERIQUE)
  return data.all
    .filter((f) => f.factor_type === 'totp')
    .map((f) => ({ id: f.id, nom: f.friendly_name ?? 'Appareil', creeLe: f.created_at, verifie: f.status === 'verified' }))
}

/** Crée un facteur TOTP en attente de vérification et renvoie le QR code à scanner. */
export async function demarrerInscriptionTotp(): Promise<InscriptionTotp> {
  // Les inscriptions abandonnées (jamais vérifiées) sont retirées pour ne pas encombrer la liste
  const existants = await listerFacteurs().catch(() => [])
  await Promise.all(existants.filter((f) => !f.verifie).map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })))
  // Un nom de facteur doit être unique pour la personne : on y ajoute un suffixe aléatoire
  const nom = `Appareil ${Math.random().toString(36).slice(2, 7)}`
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: nom, issuer: 'ColokNiamey' })
  if (error || !data) throw new Error('Impossible de préparer la double authentification. Vérifie qu\'elle est activée dans Supabase.')
  return { facteurId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
}

/** Vérifie un code à 6 chiffres (inscription d'un appareil, ou défi à la connexion). */
export async function verifierCode(facteurId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: facteurId, code: code.replace(/\s/g, '') })
  if (error) {
    throw new Error(
      error.code === 'mfa_verification_failed' || error.code === 'mfa_challenge_expired'
        ? 'Code incorrect ou expiré. Vérifie l\'heure de ton téléphone et réessaie.'
        : GENERIQUE,
    )
  }
}

/** Retire un facteur (non vérifié abandonné, ou appareil remplacé). */
export async function supprimerFacteur(facteurId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId: facteurId })
  if (error) throw new Error(GENERIQUE)
}

// --- Session admin (RGA36) ---

/** Prévient la base que l'admin agit (au plus toutes les 5 minutes, voir le store). */
export async function signalerActivite(): Promise<void> {
  const { error } = await supabase.rpc('signaler_activite_admin')
  if (error) throw new Error(messageErreur(error))
}

// --- Files de travail et relances (RGA29 à RGA32) ---

export async function lireFiles(): Promise<EtatFile[]> {
  const { data, error } = await supabase.rpc('etat_files_admin')
  if (error) throw new Error(messageErreur(error))
  return data.map((f) => ({ nom: f.nom, libelle: f.libelle, lien: f.lien, nombre: Number(f.nombre), plusAncien: f.plus_ancien ?? null }))
}

export async function lireRelancesNonVues(): Promise<RelanceRecue[]> {
  const { data, error } = await supabase.rpc('mes_relances_non_vues')
  if (error) throw new Error(messageErreur(error))
  return data.map((r) => ({ id: Number(r.id), creeLe: r.cree_le, motif: r.motif ?? null }))
}

export async function marquerRelanceVue(id: number): Promise<void> {
  const { error } = await supabase.rpc('marquer_relance_vue', { p_id: id })
  if (error) throw new Error(messageErreur(error))
}

// --- Préférences d'e-mail du super-admin (RGA35) ---

export async function lirePreferences(): Promise<{ recap: boolean; alertes: boolean }> {
  const { data, error } = await supabase.rpc('mes_preferences_admin')
  if (error) throw new Error(messageErreur(error))
  const ligne = data[0]
  return { recap: ligne?.recap_quotidien ?? true, alertes: ligne?.alertes_urgentes ?? true }
}

export async function definirPreferences(recap: boolean, alertes: boolean): Promise<void> {
  const { error } = await supabase.rpc('definir_preferences_admin', { p_recap: recap, p_alertes: alertes })
  if (error) throw new Error(messageErreur(error))
}

// --- Notifications dans l'application (RGA29) ---

export interface NotificationApp {
  id: number
  titre: string
  lien: string | null
  lu: boolean
  creeLe: string
}

/** RG10 : la RLS ne renvoie que les notifications de la personne connectée. */
export async function lireNotifications(): Promise<NotificationApp[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, titre, lien, lu, created_at')
    .order('id', { ascending: false })
    .limit(30)
  if (error) throw new Error(GENERIQUE)
  return data.map((n) => ({ id: Number(n.id), titre: n.titre, lien: n.lien, lu: n.lu, creeLe: n.created_at }))
}

export async function marquerNotificationsLues(): Promise<void> {
  const { error } = await supabase.from('notifications').update({ lu: true }).eq('lu', false)
  if (error) throw new Error(GENERIQUE)
}
