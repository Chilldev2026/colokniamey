// Contrôles du formulaire de profil : ils servent seulement au confort de l'utilisateur.
// La sécurité vient de la base (contraintes, RLS, déclencheurs de S) : voir 0300 et 0400.

import { validerTelephone } from '@/modules/auth'
import type { DonneesProfil } from './types'

export type ErreursProfil = Partial<Record<keyof DonneesProfil, string>>

export const MAX_CENTRES_INTERET = 5

/** Transforme « Football, Lecture ,  » en ['Football', 'Lecture']. */
export function lireCentresInteret(texte: string): string[] {
  return texte
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c !== '')
}

export function validerProfil(d: DonneesProfil, role: string): ErreursProfil {
  const erreurs: ErreursProfil = {}

  if (d.prenom.trim() === '') erreurs.prenom = 'Entre ton prénom.'
  else if (d.prenom.trim().length > 100) erreurs.prenom = '100 caractères au plus.'
  if (d.nom.trim() === '') erreurs.nom = 'Entre ton nom.'
  else if (d.nom.trim().length > 100) erreurs.nom = '100 caractères au plus.'

  const tel = validerTelephone(d.telephone)
  if (tel) erreurs.telephone = tel

  if (d.profession.trim().length > 80) erreurs.profession = '80 caractères au plus.'

  const centres = lireCentresInteret(d.centresInteret)
  if (centres.length > MAX_CENTRES_INTERET) {
    erreurs.centresInteret = `${MAX_CENTRES_INTERET} centres d'intérêt au plus.`
  } else if (centres.some((c) => c.length < 2 || c.length > 40)) {
    erreurs.centresInteret = 'Chaque centre d\'intérêt doit avoir entre 2 et 40 caractères.'
  }

  if (role === 'etudiant') {
    if (d.universiteId === '') erreurs.universiteId = 'Choisis ton université.'
    if (d.niveauEtude.trim().length > 50) erreurs.niveauEtude = '50 caractères au plus.'
    if (d.filiere.trim().length > 100) erreurs.filiere = '100 caractères au plus.'
    if (d.bio.trim().length > 500) erreurs.bio = '500 caractères au plus.'
    if (d.budgetMax.trim() !== '' && !/^\d{1,9}$/.test(d.budgetMax.trim())) {
      erreurs.budgetMax = 'Entre un montant en FCFA, sans espace ni virgule.'
    }
  }
  if (role === 'proprietaire' && d.adresse.trim().length > 300) erreurs.adresse = '300 caractères au plus.'

  return erreurs
}
