// Seul endroit du module M8 qui appelle Supabase. Les groupes sont lisibles par les utilisateurs connectés ; toute écriture
// passe par une fonction SQL qui vérifie le rôle, l'identité (K) et les places. Les messages d'erreur de la base
// (code P0001) sont en français : on les montre tels quels.
import { supabase } from '@/core/supabase'
import { controlerTexte, messageErreurContenu } from '@/modules/securite'

export interface GroupeLogement {
  id: number
  initiateurId: string
  initiateurPrenom: string
  initiateurInitiale: string
  placesRecherchees: number
  membres: number
  placesRestantes: number
  partEstimee: number
  message: string | null
  preferences: string | null
  statut: 'en_formation' | 'complet' | 'cloture'
  monStatut: 'en_attente' | 'accepte' | 'refuse' | 'parti' | null
}

export interface MembreGroupe {
  membreId: number
  userId: string
  prenom: string
  initiale: string
  role: 'initiateur' | 'membre'
  statut: 'accepte' | 'en_attente'
}

export interface MonGroupe {
  id: number
  annonceId: number
  annonceTitre: string
  statut: 'en_formation' | 'complet' | 'cloture'
  monRole: 'initiateur' | 'membre'
  monStatut: 'en_attente' | 'accepte'
  placesRecherchees: number
  membres: number
  demandesEnAttente: number
  partEstimee: number
  derniereActivite: string
}

const GENERIQUE = 'Une erreur est survenue. Réessaie dans un moment.'

function statutGroupe(v: string): GroupeLogement['statut'] {
  return v === 'complet' || v === 'cloture' ? v : 'en_formation'
}
function statutMembre(v: string | null | undefined): GroupeLogement['monStatut'] {
  return v === 'en_attente' || v === 'accepte' || v === 'refuse' || v === 'parti' ? v : null
}

/** RG35, RG37 : groupes en formation sur un logement (le propriétaire voit aussi les groupes complets). */
export async function groupesDuLogement(annonceId: number): Promise<GroupeLogement[]> {
  const { data, error } = await supabase.rpc('groupes_du_logement', { p_annonce_id: annonceId })
  if (error) throw new Error(GENERIQUE)
  return data.map((g) => ({
    id: g.id, initiateurId: g.initiateur_id, initiateurPrenom: g.initiateur_prenom, initiateurInitiale: g.initiateur_initiale,
    placesRecherchees: g.places_recherchees, membres: g.membres, placesRestantes: g.places_restantes, partEstimee: g.part_estimee_fcfa,
    message: g.message ?? null, preferences: g.preferences ?? null, statut: statutGroupe(g.statut), monStatut: statutMembre(g.mon_statut),
  }))
}

export async function membresDuGroupe(groupeId: number): Promise<MembreGroupe[]> {
  const { data, error } = await supabase.rpc('membres_du_groupe', { p_groupe_id: groupeId })
  if (error) throw new Error(GENERIQUE)
  return data.map((m) => ({
    membreId: m.membre_id, userId: m.user_id, prenom: m.prenom, initiale: m.initiale,
    role: m.role === 'initiateur' ? 'initiateur' : 'membre', statut: m.statut === 'en_attente' ? 'en_attente' : 'accepte',
  }))
}

export async function mesGroupes(): Promise<MonGroupe[]> {
  const { data, error } = await supabase.rpc('mes_groupes')
  if (error) throw new Error(GENERIQUE)
  return data.map((g) => ({
    id: g.id, annonceId: g.annonce_id, annonceTitre: g.annonce_titre, statut: statutGroupe(g.statut),
    monRole: g.mon_role === 'initiateur' ? 'initiateur' : 'membre', monStatut: g.mon_statut === 'en_attente' ? 'en_attente' : 'accepte',
    placesRecherchees: g.places_recherchees, membres: g.membres, demandesEnAttente: g.demandes_en_attente, partEstimee: g.part_estimee_fcfa,
    derniereActivite: g.derniere_activite,
  }))
}

/** RG45 : message et préférences passent par le contrôle de S avant l'envoi (blocage journalisé, RG47). */
async function verifierTextes(textes: string[]): Promise<void> {
  for (const t of textes) {
    if (t.trim() !== '' && (await controlerTexte(t, 'public')) === 'bloque') {
      throw new Error('Ce texte ne respecte pas les règles de ColokNiamey. Modifie-le et réessaie.')
    }
  }
}

/** RG34 : lancer un groupe sur un logement publié par un propriétaire. */
export async function creerGroupe(annonceId: number, places: number, message: string, preferences: string): Promise<number> {
  await verifierTextes([message, preferences])
  const { data, error } = await supabase.rpc('creer_groupe', {
    p_annonce_id: annonceId, p_places: places, p_message: message.trim(), p_preferences: preferences.trim(),
  })
  if (error || typeof data !== 'number') throw new Error(messageErreurContenu(error))
  return data
}

export async function demanderAdhesion(groupeId: number): Promise<void> {
  const { error } = await supabase.rpc('demander_adhesion', { p_groupe_id: groupeId })
  if (error) throw new Error(messageErreurContenu(error))
}

export async function repondreDemande(membreId: number, accepter: boolean): Promise<void> {
  const { error } = await supabase.rpc('repondre_demande', { p_membre_id: membreId, p_accepter: accepter })
  if (error) throw new Error(messageErreurContenu(error))
}

export async function quitterGroupe(groupeId: number): Promise<void> {
  const { error } = await supabase.rpc('quitter_groupe', { p_groupe_id: groupeId })
  if (error) throw new Error(messageErreurContenu(error))
}
