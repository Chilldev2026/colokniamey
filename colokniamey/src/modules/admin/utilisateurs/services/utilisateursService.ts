// Seul endroit du sous-module « utilisateurs » qui appelle Supabase.
// Toutes les actions sur les comptes passent par l'Edge Function admin-utilisateurs (RGA27).

import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/core/supabase'
import { messageErreur } from '../../services/adminService'
import type {
  ActionCompte, AdminRelance, Administrateur, FicheUtilisateur, FiltresUtilisateurs, RoleCompte, StatutCompte,
  SuiviRelance, UtilisateurListe,
} from '../types'

export const PAR_PAGE = 20

export async function listerUtilisateurs(f: FiltresUtilisateurs, page: number): Promise<{ lignes: UtilisateurListe[]; total: number }> {
  const { data, error } = await supabase.rpc('liste_utilisateurs', {
    p_recherche: f.recherche.trim() || undefined,
    p_role: f.role || undefined,
    p_statut: f.statut || undefined,
    p_depuis: f.depuis || undefined,
    p_jusqua: f.jusqua || undefined,
    p_limite: PAR_PAGE,
    p_decalage: (page - 1) * PAR_PAGE,
  })
  if (error) throw new Error(messageErreur(error))
  return {
    lignes: data.map((u) => ({
      id: u.id, prenom: u.prenom, nom: u.nom, email: u.email, telephone: u.telephone,
      role: u.role as RoleCompte, statut: u.statut as StatutCompte, creeLe: u.created_at,
    })),
    total: data.length > 0 ? Number(data[0]!.total) : 0,
  }
}

export async function lireFiche(id: string): Promise<FicheUtilisateur> {
  const { data, error } = await supabase.rpc('fiche_utilisateur', { p_id: id })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error(messageErreur(error))
  const f = data as Record<string, unknown>
  const texte = (v: unknown): string | null => (typeof v === 'string' ? v : null)
  const historique = Array.isArray(f.historique) ? (f.historique as Record<string, unknown>[]) : []
  const compteurs = typeof f.compteurs === 'object' && f.compteurs !== null ? (f.compteurs as Record<string, unknown>) : {}
  return {
    id: String(f.id), prenom: String(f.prenom), nom: String(f.nom), email: String(f.email), telephone: String(f.telephone),
    role: f.role as RoleCompte, statut: f.statut as StatutCompte,
    motifSuspension: texte(f.motif_suspension), suspenduJusqua: texte(f.suspendu_jusqua),
    inscritLe: String(f.inscrit_le), derniereConnexion: texte(f.derniere_connexion),
    universite: texte(f.universite), typeProprietaire: texte(f.type_proprietaire),
    compteurs: Object.fromEntries(Object.entries(compteurs).map(([k, v]) => [k, Number(v)])),
    historique: historique.map((h) => ({ action: String(h.action), date: String(h.date), acteur: texte(h.acteur) })),
  }
}

/** Message d'une erreur renvoyée par une Edge Function : { erreur: "…" } en français. */
export async function messageFonction(erreur: unknown): Promise<string> {
  if (erreur instanceof FunctionsHttpError) {
    try {
      const corps: unknown = await erreur.context.json()
      if (typeof corps === 'object' && corps !== null && 'erreur' in corps && typeof corps.erreur === 'string') return corps.erreur
    } catch {
      // corps illisible : message générique ci-dessous
    }
  }
  return 'Une erreur est survenue. Réessaie dans un moment.'
}

export interface ParametresAction {
  motif?: string
  jusqua?: string
  role?: 'admin' | 'etudiant' | 'proprietaire'
}

export async function executerAction(action: ActionCompte, cibleId: string, params: ParametresAction = {}): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-utilisateurs', { body: { action, cible_id: cibleId, ...params } })
  if (error) throw new Error(await messageFonction(error))
}

// --- Administrateurs et relances (super-admin) ---

export async function listerAdministrateurs(): Promise<Administrateur[]> {
  const { data, error } = await supabase.rpc('liste_administrateurs')
  if (error) throw new Error(messageErreur(error))
  return data.map((a) => ({
    id: a.id, prenom: a.prenom, nom: a.nom, email: a.email, telephone: a.telephone,
    role: a.role === 'super_admin' ? 'super_admin' : 'admin', statut: a.statut as StatutCompte,
    derniereConnexion: a.derniere_connexion ?? null,
  }))
}

export async function listerRelances(): Promise<SuiviRelance[]> {
  const { data, error } = await supabase.rpc('liste_relances')
  if (error) throw new Error(messageErreur(error))
  return data.map((r) => ({
    id: Number(r.id), aId: r.a_id, aPrenom: r.a_prenom ?? 'Admin',
    canal: r.canal as SuiviRelance['canal'], motif: r.motif ?? null, creeLe: r.cree_le, vuLe: r.vu_le ?? null,
  }))
}

/** RGA31 : relance un admin (ou tous si cibleId est null). Renvoie les admins relancés et le texte neutre à envoyer. */
export async function relancer(cibleId: string | null, canal: SuiviRelance['canal'], motif: string): Promise<AdminRelance[]> {
  const { data, error } = await supabase.rpc('relancer_admin', {
    // null = tous les admins : l'argument doit être envoyé (les types générés ne connaissent pas les arguments nuls)
    p_cible: cibleId as string, p_canal: canal, p_motif: motif.trim() || undefined,
  })
  if (error) throw new Error(messageErreur(error))
  return data.map((r) => ({ cibleId: r.cible_id, prenom: r.prenom, resume: r.resume }))
}

export async function emailDirectActif(): Promise<boolean> {
  const { data, error } = await supabase.rpc('email_direct_actif')
  if (error) throw new Error(messageErreur(error))
  return data === true
}

/** Si le domaine d'envoi est vérifié : l'e-mail part de l'application (RGA31). */
export async function envoyerEmailDirect(destinataireId: string, sujet: string, message: string): Promise<void> {
  const { error } = await supabase.functions.invoke('core-envoyer-email', {
    body: { destinataire_id: destinataireId, sujet, message },
  })
  if (error) throw new Error(await messageFonction(error))
}
