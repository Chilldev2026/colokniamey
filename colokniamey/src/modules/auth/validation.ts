// Contrôles du formulaire : ils servent seulement au confort de l'utilisateur.
// La sécurité vient de la base (déclencheur handle_new_user, contraintes, RLS) : voir 0300_auth.sql.

import { estMotDePasseCourant } from './motsDePasseCourants'

export type RoleInscription = 'etudiant' | 'proprietaire'

export interface DonneesInscription {
  role: RoleInscription
  email: string
  motDePasse: string
  nom: string
  prenom: string
  telephone: string
  /** Identifiant d'université sous forme de texte (vide si non choisi). */
  universiteId: string
  typeProprietaire: 'particulier' | 'agence'
  conditionsAcceptees: boolean
}

export type ErreursChamps = Partial<Record<keyof DonneesInscription, string>>

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FORMAT_TELEPHONE = /^\+?[0-9 ]{8,20}$/

export function validerEmail(email: string): string | null {
  return FORMAT_EMAIL.test(email.trim()) ? null : 'Entre une adresse e-mail valide.'
}

/** RG04 : au moins 8 caractères. RGP26 : pas de mot de passe courant. */
export function validerMotDePasse(motDePasse: string, email = ''): string | null {
  if (motDePasse.length < 8) return 'Le mot de passe doit avoir au moins 8 caractères.'
  if (estMotDePasseCourant(motDePasse)) return 'Ce mot de passe est trop courant. Choisis-en un autre.'
  const debutEmail = email.split('@')[0]?.toLowerCase() ?? ''
  if (debutEmail.length >= 4 && motDePasse.toLowerCase().includes(debutEmail)) {
    return 'Ton mot de passe ne doit pas contenir ton adresse e-mail.'
  }
  return null
}

/** RG11 : téléphone obligatoire. */
export function validerTelephone(telephone: string): string | null {
  return FORMAT_TELEPHONE.test(telephone.trim()) ? null : 'Entre un numéro de téléphone valide (8 chiffres au moins).'
}

export function validerInscription(d: DonneesInscription): ErreursChamps {
  const erreurs: ErreursChamps = {}

  const email = validerEmail(d.email)
  if (email) erreurs.email = email

  const mdp = validerMotDePasse(d.motDePasse, d.email)
  if (mdp) erreurs.motDePasse = mdp

  if (d.prenom.trim() === '') erreurs.prenom = 'Entre ton prénom.'
  if (d.nom.trim() === '') erreurs.nom = 'Entre ton nom.'

  const tel = validerTelephone(d.telephone)
  if (tel) erreurs.telephone = tel

  // RG06 : un étudiant choisit son université
  if (d.role === 'etudiant' && d.universiteId === '') erreurs.universiteId = 'Choisis ton université.'

  if (!d.conditionsAcceptees) {
    erreurs.conditionsAcceptees = 'Tu dois accepter les conditions et la politique de confidentialité.'
  }
  return erreurs
}
