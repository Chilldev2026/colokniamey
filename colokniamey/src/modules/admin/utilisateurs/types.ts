// Types du sous-module « utilisateurs » (A2).

export type RoleCompte = 'etudiant' | 'proprietaire' | 'admin' | 'super_admin'
export type StatutCompte = 'actif' | 'suspendu' | 'desactive'

export interface UtilisateurListe {
  id: string
  prenom: string
  nom: string
  email: string
  telephone: string
  role: RoleCompte
  statut: StatutCompte
  creeLe: string
}

export interface FiltresUtilisateurs {
  recherche: string
  role: string
  statut: string
  depuis: string
  jusqua: string
}

export interface LigneHistorique {
  action: string
  date: string
  acteur: string | null
}

export interface FicheUtilisateur {
  id: string
  prenom: string
  nom: string
  email: string
  telephone: string
  role: RoleCompte
  statut: StatutCompte
  motifSuspension: string | null
  suspenduJusqua: string | null
  inscritLe: string
  derniereConnexion: string | null
  universite: string | null
  typeProprietaire: string | null
  /** Compteurs fournis par les autres modules (annonces, signalements reçus…). */
  compteurs: Record<string, number>
  historique: LigneHistorique[]
}

export interface Administrateur {
  id: string
  prenom: string
  nom: string
  email: string
  telephone: string
  role: 'admin' | 'super_admin'
  statut: StatutCompte
  derniereConnexion: string | null
}

export interface SuiviRelance {
  id: number
  aId: string
  aPrenom: string
  canal: 'notification' | 'email' | 'whatsapp'
  motif: string | null
  creeLe: string
  vuLe: string | null
}

export interface AdminRelance {
  cibleId: string
  prenom: string
  resume: string
}

export type ActionCompte =
  | 'suspendre'
  | 'reactiver'
  | 'changer_role'
  | 'desactiver_et_anonymiser'
  | 'supprimer_definitivement'
  | 'reinitialiser_mfa'

export const LIBELLES_ROLE_COMPTE: Record<RoleCompte, string> = {
  etudiant: 'Étudiant',
  proprietaire: 'Propriétaire',
  admin: 'Admin',
  super_admin: 'Super-admin',
}

export const LIBELLES_STATUT_COMPTE: Record<StatutCompte, string> = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  desactive: 'Désactivé',
}

/** Libellés lisibles des actions du journal d'audit, pour l'historique d'une fiche. */
export const LIBELLES_ACTION_AUDIT: Record<string, string> = {
  suspension: 'Suspension',
  reactivation: 'Réactivation',
  fin_suspension: 'Fin de la suspension',
  changement_role: 'Changement de rôle',
  desactivation_anonymisation: 'Désactivation et anonymisation',
  suppression_definitive: 'Suppression définitive',
  reinitialisation_mfa: 'Double authentification réinitialisée',
  relance: 'Relance',
  contenu_bloque: 'Contenu bloqué',
  desactivation_compte: 'Désactivation par la personne',
  export_donnees: 'Export des données',
}

/** Rang d'un rôle : un admin n'agit que sur un rang strictement inférieur (RGA02). */
export function rang(role: RoleCompte): number {
  return role === 'super_admin' ? 2 : role === 'admin' ? 1 : 0
}

/**
 * Actions proposées à l'écran pour une cible, selon le rôle de la personne connectée.
 * Ce n'est qu'un confort : la base et l'Edge Function refusent de toute façon (RGA27).
 */
export function actionsPossibles(moi: { id: string; role: RoleCompte }, cible: { id: string; role: RoleCompte; statut: StatutCompte }): ActionCompte[] {
  if (cible.id === moi.id || cible.statut === 'desactive') return []
  const actions: ActionCompte[] = []
  const superieur = rang(moi.role) > rang(cible.role)
  if (superieur) {
    actions.push(cible.statut === 'suspendu' ? 'reactiver' : 'suspendre')
    actions.push('desactiver_et_anonymiser')
  }
  if (moi.role === 'super_admin') {
    if (cible.role === 'etudiant' || cible.role === 'proprietaire') {
      if (cible.statut === 'actif') actions.push('changer_role')
    } else if (cible.role === 'admin') {
      actions.push('changer_role')
    }
    // RGA38 : réservée au super-admin, possible sur un autre super-admin
    if (cible.role === 'admin' || cible.role === 'super_admin') actions.push('reinitialiser_mfa')
    // RGA09 : suppression définitive, super-admin seulement et jamais sur un niveau égal
    if (superieur) actions.push('supprimer_definitivement')
  }
  return actions
}
