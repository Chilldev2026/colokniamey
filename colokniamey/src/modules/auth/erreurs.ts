// Traduction des erreurs de Supabase Auth en messages français, sans détail technique.
// RGP26 : à la connexion et au mot de passe oublié, les messages restent génériques
// pour ne pas révéler si une adresse e-mail possède un compte.

export interface ErreurAuth {
  code?: string
  message: string
  status?: number
}

export type ContexteAuth = 'connexion' | 'inscription' | 'reinitialisation' | 'mot_de_passe'

const GENERIQUE = 'Une erreur est survenue. Réessaie dans un moment.'

export function traduireErreurAuth(erreur: ErreurAuth, contexte: ContexteAuth): string {
  const code = erreur.code ?? ''

  // Communs à tous les formulaires
  if (code === 'captcha_failed' || /captcha/i.test(erreur.message)) {
    return 'La vérification anti-robots a échoué. Réessaie.'
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || erreur.status === 429) {
    return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.'
  }

  switch (contexte) {
    case 'connexion':
      // RG08 : un compte suspendu reçoit une erreur d'utilisateur banni
      if (code === 'user_banned' || /banned/i.test(erreur.message)) {
        return 'Compte suspendu. Contacte l\'équipe ColokNiamey pour en savoir plus.'
      }
      if (code === 'email_not_confirmed') {
        return 'Confirme d\'abord ton adresse e-mail avec le lien que nous t\'avons envoyé.'
      }
      // Message volontairement identique que l'e-mail existe ou non
      return 'E-mail ou mot de passe incorrect.'

    case 'inscription':
      if (code === 'user_already_exists' || code === 'email_exists') {
        return 'Cette adresse e-mail est déjà utilisée.'
      }
      if (code === 'weak_password') {
        return 'Ce mot de passe est trop faible. Choisis-en un plus long ou moins courant.'
      }
      if (code === 'signup_disabled') return 'Les inscriptions sont fermées pour le moment.'
      if (code === 'validation_failed' || code === 'email_address_invalid') {
        return 'Cette adresse e-mail n\'est pas valide.'
      }
      // Le déclencheur handle_new_user refuse sans message lisible côté client
      if (code === 'unexpected_failure' || /database error/i.test(erreur.message)) {
        return 'Inscription impossible. Vérifie que tous les champs sont remplis correctement.'
      }
      return GENERIQUE

    case 'reinitialisation':
      // Aucune indication sur l'existence du compte
      return GENERIQUE

    case 'mot_de_passe':
      if (code === 'same_password') return 'Choisis un mot de passe différent de l\'ancien.'
      if (code === 'weak_password') return 'Ce mot de passe est trop faible. Choisis-en un autre.'
      if (code === 'session_not_found' || code === 'not_authenticated') {
        return 'Le lien a expiré. Demande un nouveau lien de réinitialisation.'
      }
      return GENERIQUE
  }
}
