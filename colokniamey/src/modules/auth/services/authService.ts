// Seul endroit du module qui appelle Supabase Auth et la table profils.
// Chaque fonction lève une Error dont le message est déjà en français et sans détail technique.

import { supabase } from '@/core/supabase'
import { traduireErreurAuth } from '../erreurs'
import type { Profil } from '../types'
import type { DonneesInscription } from '../validation'

const ORIGINE = () => window.location.origin

/** RG01, RG04, RG06, RG11, RGP12 : le déclencheur handle_new_user refait tous ces contrôles. */
export async function inscrire(donnees: DonneesInscription, captchaToken: string, versionCgu: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: donnees.email.trim(),
    password: donnees.motDePasse,
    options: {
      captchaToken,
      emailRedirectTo: `${ORIGINE()}/connexion`,
      data: {
        role: donnees.role,
        nom: donnees.nom.trim(),
        prenom: donnees.prenom.trim(),
        telephone: donnees.telephone.trim(),
        universite_id: donnees.role === 'etudiant' ? donnees.universiteId : '',
        type_proprietaire: donnees.role === 'proprietaire' ? donnees.typeProprietaire : '',
        // RGP12 : version des conditions acceptée, enregistrée dans profils
        cgu_version: donnees.conditionsAcceptees ? versionCgu : '',
      },
    },
  })
  if (error) throw new Error(traduireErreurAuth(error, 'inscription'))
}

export async function connecter(email: string, motDePasse: string, captchaToken: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: motDePasse,
    options: { captchaToken },
  })
  if (error) throw new Error(traduireErreurAuth(error, 'connexion'))
}

/** RG12 : la déconnexion met fin à la session. */
export async function deconnecter(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error('La déconnexion a échoué. Réessaie.')
}

/** RGP06 : fin de toutes les sessions, sur tous les appareils. */
export async function deconnecterPartout(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) throw new Error('La déconnexion a échoué. Réessaie.')
}

/** RGP26 : même résultat que l'adresse existe ou non. */
export async function demanderReinitialisation(email: string, captchaToken: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${ORIGINE()}/reinitialiser`,
    captchaToken,
  })
  if (error) throw new Error(traduireErreurAuth(error, 'reinitialisation'))
}

export async function changerMotDePasse(motDePasse: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: motDePasse })
  if (error) throw new Error(traduireErreurAuth(error, 'mot_de_passe'))
}

/** RG10 : la RLS ne renvoie que le profil de la personne connectée. */
export async function lireProfil(userId: string): Promise<Profil | null> {
  const { data, error } = await supabase.from('profils').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error('Impossible de charger ton profil.')
  return data
}

/** RGP12 : enregistre l'acceptation de la version en vigueur. */
export async function accepterCgu(version: string): Promise<void> {
  const { error } = await supabase.rpc('accepter_cgu', { p_version: version })
  if (error) throw new Error('Impossible d\'enregistrer ton acceptation. Réessaie.')
}
