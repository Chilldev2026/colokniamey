// Seul endroit des sous-modules « audit », « erreurs » et « supervision » (A6) qui appelle Supabase. Les droits sont
// revérifiés par la base : le super-admin lit tout, l'admin ne lit que ses propres lignes d'audit (RGA26, RGA27).
// Aucune fonction ne modifie le journal : il est en ajout seul (RGA07).
import { supabase } from '@/core/supabase'
import { messageErreur } from '../../services/adminService'

const nombre = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0))
const objet = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

// --- Journal d'audit ---

export interface LigneJournal {
  id: number
  creeLe: string
  acteurId: string | null
  acteurPrenom: string | null
  action: string
  cibleType: string | null
  cibleId: string | null
  details: Record<string, unknown>
}
export interface FiltresJournal {
  acteur: string
  action: string
  cible: string
  depuis: string
  jusqua: string
}
export const TAILLE_PAGE_JOURNAL = 50

export async function listerJournal(f: FiltresJournal, page: number, limite = TAILLE_PAGE_JOURNAL): Promise<LigneJournal[]> {
  const { data, error } = await supabase.rpc('liste_journal', {
    ...(f.acteur ? { p_acteur: f.acteur } : {}),
    ...(f.action ? { p_action: f.action } : {}),
    ...(f.cible ? { p_cible_type: f.cible } : {}),
    ...(f.depuis ? { p_depuis: f.depuis } : {}),
    ...(f.jusqua ? { p_jusqua: f.jusqua } : {}),
    p_limite: limite,
    p_decalage: (page - 1) * TAILLE_PAGE_JOURNAL,
  })
  if (error) throw new Error(messageErreur(error))
  return data.map((j) => ({
    id: j.id, creeLe: j.created_at, acteurId: j.acteur_id ?? null, acteurPrenom: j.acteur_prenom ?? null, action: j.action,
    cibleType: j.cible_type ?? null, cibleId: j.cible_id ?? null, details: objet(j.details),
  }))
}

export async function lireFiltresJournal(): Promise<{ actions: string[]; cibles: string[]; acteurs: { id: string; prenom: string }[] }> {
  const { data, error } = await supabase.rpc('filtres_journal')
  if (error) throw new Error(messageErreur(error))
  const j = objet(data)
  return {
    actions: liste(j.actions).map(String),
    cibles: liste(j.cibles).map(String),
    acteurs: liste(j.acteurs).map((a) => ({ id: String(objet(a).id), prenom: String(objet(a).prenom) })),
  }
}

/**
 * Comparaison avant / après d'une ligne : repère les paires de clés connues (avant/apres, ancien/nouveau, old/new).
 * Les autres détails sont listés tels quels, sans comparaison.
 */
export function comparerDetails(details: Record<string, unknown>): { avant: unknown; apres: unknown } | null {
  for (const [a, b] of [['avant', 'apres'], ['ancien', 'nouveau'], ['old', 'new']] as const) {
    if (a in details && b in details) return { avant: details[a], apres: details[b] }
  }
  return null
}

// --- Erreurs (RGA19) ---

export type StatutErreur = 'nouveau' | 'en_cours' | 'resolu' | 'ignore'
export interface ErreurApp {
  id: number
  message: string
  module: string | null
  page: string | null
  occurrences: number
  statut: StatutErreur
  premiereVue: string
  derniereVue: string
  pile: string | null
  navigateur: string | null
  version: string | null
}

function statutErreur(v: string): StatutErreur {
  return v === 'en_cours' || v === 'resolu' || v === 'ignore' ? v : 'nouveau'
}

export async function listerErreurs(statut: string, jours: number): Promise<ErreurApp[]> {
  const { data, error } = await supabase.rpc('liste_erreurs', { ...(statut ? { p_statut: statut } : {}), p_jours: jours })
  if (error) throw new Error(messageErreur(error))
  return data.map((e) => ({
    id: e.id, message: e.message, module: e.module ?? null, page: e.page ?? null, occurrences: e.occurrences, statut: statutErreur(e.statut),
    premiereVue: e.premiere_vue, derniereVue: e.derniere_vue, pile: e.pile ?? null, navigateur: e.navigateur ?? null, version: e.version ?? null,
  }))
}

export async function changerStatutErreur(id: number, statut: StatutErreur): Promise<void> {
  const { error } = await supabase.rpc('changer_statut_erreur', { p_id: id, p_statut: statut })
  if (error) throw new Error(messageErreur(error))
}

// --- Supervision (RGA21 à RGA25) ---

export type PeriodeSupervision = '1h' | '24h' | '7j'
export interface Supervision {
  requetes: { total: number; pagesVues: number; parPas: { t: string; requetes: number; pagesVues: number }[]; parModule: { module: string; requetes: number }[] }
  erreurs: { tauxGlobal: number; parModule: { module: string; requetes: number; erreurs: number; taux: number }[]; pagesEnEchec: { page: string; occurrences: number }[] }
  latence: { global: { p50: number; p95: number; p99: number } | null; parModule: { module: string; p50: number; p95: number; p99: number }[] }
  saturation: {
    baseMo: number; limiteBaseMo: number; basePct: number
    stockageMo: number; limiteStockageMo: number; stockagePct: number
    connexions: number; limiteConnexions: number; connexionsPct: number
    limiteAppelsEdge: number; seuilAlertePct: number
  }
}

export async function lireSupervision(periode: PeriodeSupervision): Promise<Supervision> {
  const { data, error } = await supabase.rpc('supervision', { p_periode: periode })
  if (error) throw new Error(messageErreur(error))
  const j = objet(data)
  const r = objet(j.requetes)
  const e = objet(j.erreurs)
  const l = objet(j.latence)
  const s = objet(j.saturation)
  const g = objet(l.global)
  return {
    requetes: {
      total: nombre(r.total), pagesVues: nombre(r.pages_vues),
      parPas: liste(r.par_pas).map((x) => ({ t: String(objet(x).t), requetes: nombre(objet(x).requetes), pagesVues: nombre(objet(x).pages_vues) })),
      parModule: liste(r.par_module).map((x) => ({ module: String(objet(x).module), requetes: nombre(objet(x).requetes) })),
    },
    erreurs: {
      tauxGlobal: nombre(e.taux_global_pct),
      parModule: liste(e.par_module).map((x) => ({ module: String(objet(x).module), requetes: nombre(objet(x).requetes), erreurs: nombre(objet(x).erreurs), taux: nombre(objet(x).taux_pct) })),
      pagesEnEchec: liste(e.pages_en_echec).map((x) => ({ page: String(objet(x).page), occurrences: nombre(objet(x).occurrences) })),
    },
    latence: {
      global: 'p50' in g ? { p50: nombre(g.p50), p95: nombre(g.p95), p99: nombre(g.p99) } : null,
      parModule: liste(l.par_module).map((x) => ({ module: String(objet(x).module), p50: nombre(objet(x).p50), p95: nombre(objet(x).p95), p99: nombre(objet(x).p99) })),
    },
    saturation: {
      baseMo: nombre(s.base_mo), limiteBaseMo: nombre(s.limite_base_mo), basePct: nombre(s.base_pct),
      stockageMo: nombre(s.stockage_mo), limiteStockageMo: nombre(s.limite_stockage_mo), stockagePct: nombre(s.stockage_pct),
      connexions: nombre(s.connexions), limiteConnexions: nombre(s.limite_connexions), connexionsPct: nombre(s.connexions_pct),
      limiteAppelsEdge: nombre(s.limite_appels_edge), seuilAlertePct: nombre(s.seuil_alerte_pct),
    },
  }
}

export async function listerSeuils(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('liste_seuils')
  if (error) throw new Error(messageErreur(error))
  return Object.fromEntries(data.map((s) => [s.cle, Number(s.valeur)]))
}

export async function definirSeuil(cle: string, valeur: number): Promise<void> {
  const { error } = await supabase.rpc('definir_seuil', { p_cle: cle, p_valeur: valeur })
  if (error) throw new Error(messageErreur(error))
}

export async function lireAlertesSupervision(): Promise<{ type: string; depuis: string | null; valeur: number | null }[]> {
  const { data, error } = await supabase.rpc('alertes_supervision_actives')
  if (error) return []
  return data.map((a) => ({ type: a.type, depuis: a.depuis ?? null, valeur: a.valeur === null || a.valeur === undefined ? null : Number(a.valeur) }))
}
