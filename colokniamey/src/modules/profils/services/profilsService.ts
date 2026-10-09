// Seul endroit du module M3 qui appelle Supabase.
// Les exceptions de la base (code P0001) sont déjà en français : on les montre, les autres restent génériques.

import { supabase } from '@/core/supabase'
import { messageErreurContenu } from '@/modules/securite'
import { lireCentresInteret } from '../validation'
import type { DonneesProfil, EtatAvatar, MonProfil, ProfilPublic } from '../types'

const ECHEC_LECTURE = 'Impossible de charger ton profil. Réessaie.'

/** RG10 : la RLS ne renvoie que les lignes de la personne connectée. */
export async function lireMonProfil(userId: string): Promise<MonProfil> {
  const [base, etudiant, proprietaire, complements] = await Promise.all([
    supabase.from('profils').select('id, role, statut, nom, prenom, telephone').eq('id', userId).maybeSingle(),
    supabase.from('profils_etudiants').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('profils_proprietaires').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('profils_complements').select('profession, centres_interet').eq('user_id', userId).maybeSingle(),
  ])
  if (base.error || !base.data) throw new Error(ECHEC_LECTURE)
  if (etudiant.error || proprietaire.error || complements.error) throw new Error(ECHEC_LECTURE)

  return {
    ...base.data,
    etudiant: etudiant.data
      ? {
          universiteId: String(etudiant.data.universite_id),
          niveauEtude: etudiant.data.niveau_etude ?? '',
          filiere: etudiant.data.filiere ?? '',
          budgetMax: etudiant.data.budget_max === null ? '' : String(etudiant.data.budget_max),
          bio: etudiant.data.bio ?? '',
        }
      : null,
    proprietaire: proprietaire.data
      ? {
          typeProprietaire: proprietaire.data.type_proprietaire === 'agence' ? 'agence' : 'particulier',
          adresse: proprietaire.data.adresse ?? '',
        }
      : null,
    profession: complements.data?.profession ?? '',
    centresInteret: complements.data?.centres_interet ?? [],
  }
}

/** RG10 : chacun ne modifie que son propre profil (RLS et droits de colonnes). Rôle et statut ne sont jamais envoyés. */
export async function enregistrerProfil(userId: string, role: MonProfil['role'], d: DonneesProfil): Promise<void> {
  const base = await supabase
    .from('profils')
    .update({ nom: d.nom.trim(), prenom: d.prenom.trim(), telephone: d.telephone.trim() })
    .eq('id', userId)
  if (base.error) throw new Error(messageErreurContenu(base.error))

  if (role === 'etudiant') {
    const { error } = await supabase
      .from('profils_etudiants')
      .update({
        universite_id: Number(d.universiteId),
        niveau_etude: d.niveauEtude.trim() || null,
        filiere: d.filiere.trim() || null,
        budget_max: d.budgetMax.trim() === '' ? null : Number(d.budgetMax),
        bio: d.bio.trim() || null,
      })
      .eq('user_id', userId)
    if (error) throw new Error(messageErreurContenu(error))
  } else if (role === 'proprietaire') {
    const { error } = await supabase
      .from('profils_proprietaires')
      .update({ type_proprietaire: d.typeProprietaire, adresse: d.adresse.trim() || null })
      .eq('user_id', userId)
    if (error) throw new Error(messageErreurContenu(error))
  }

  // Compléments (profession, centres d'intérêt) : mise à jour, ou création au premier enregistrement
  const complements = { profession: d.profession.trim() || null, centres_interet: lireCentresInteret(d.centresInteret) }
  const maj = await supabase.from('profils_complements').update(complements).eq('user_id', userId).select('user_id')
  if (maj.error) throw new Error(messageErreurContenu(maj.error))
  if (maj.data.length === 0) {
    const { error } = await supabase.from('profils_complements').insert({ user_id: userId, ...complements })
    if (error) throw new Error(messageErreurContenu(error))
  }
}

/** RG49, RG51 : avatar validé et état du dernier envoi. */
export async function lireMonAvatar(): Promise<EtatAvatar> {
  const { data, error } = await supabase.rpc('mon_avatar')
  if (error) throw new Error(ECHEC_LECTURE)
  const ligne = data[0]
  const statut = ligne?.statut
  return {
    cheminValide: ligne?.chemin_valide ?? null,
    statut: statut === 'en_attente' || statut === 'validee' || statut === 'refusee' ? statut : null,
    motif: ligne?.motif ?? null,
  }
}

/** Adresse publique d'un avatar validé (bucket photos_publiques). */
export function urlAvatar(chemin: string): string {
  return supabase.storage.from('photos_publiques').getPublicUrl(chemin).data.publicUrl
}

/** Profil public minimal, ou null si introuvable, suspendu, désactivé ou admin. */
export async function lireProfilPublic(id: string): Promise<ProfilPublic | null> {
  const { data, error } = await supabase.rpc('profil_public', { p_id: id })
  if (error) throw new Error('Impossible de charger ce profil.')
  // Les types générés ne connaissent pas les valeurs nulles des fonctions : on relit chaque champ avec prudence
  const p = data[0] as Record<string, unknown> | undefined
  if (!p) return null
  return {
    id: String(p.id),
    prenom: String(p.prenom),
    initialeNom: String(p.initiale_nom ?? ''),
    role: p.role === 'proprietaire' ? 'proprietaire' : 'etudiant',
    universite: typeof p.universite === 'string' ? p.universite : null,
    typeProprietaire: p.type_proprietaire === 'agence' ? 'agence' : p.type_proprietaire === 'particulier' ? 'particulier' : null,
    membreDepuis: String(p.membre_depuis),
    avatarChemin: typeof p.avatar_chemin === 'string' ? p.avatar_chemin : null,
    profession: typeof p.profession === 'string' ? p.profession : null,
    centresInteret: Array.isArray(p.centres_interet) ? p.centres_interet.map(String) : [],
  }
}

/** RGA09 : désactivation avec anonymisation. La confirmation exacte est exigée par la base. */
export async function desactiverCompte(): Promise<void> {
  const { error } = await supabase.rpc('desactiver_mon_compte', { p_confirmation: 'DESACTIVER' })
  if (error) throw new Error(messageErreurContenu(error))
}

/** RGP11 : export JSON de ses propres données. */
export async function exporterMesDonnees(): Promise<string> {
  const { data, error } = await supabase.rpc('exporter_mes_donnees')
  if (error) throw new Error(messageErreurContenu(error))
  return JSON.stringify(data, null, 2)
}
