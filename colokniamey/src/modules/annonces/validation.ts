// Contrôles du formulaire d'annonce. Ils ne servent qu'au confort : la vraie protection est dans la base
// (contraintes, déclencheurs, RLS). Les règles sont les mêmes que celles de 0970_annonces.sql.

import { LIMITES, type FormulaireAnnonce, type LigneRegle, type LigneTache } from './types'

export type ErreursAnnonce = Partial<Record<string, string>>

/** Entier positif saisi dans un champ de texte, ou null s'il est vide ou invalide. */
export function lireEntier(valeur: string): number | null {
  const v = valeur.replace(/\s/g, '')
  if (v === '' || !/^\d+$/.test(v)) return null
  return Number(v)
}

/** Étape 1 : logement et prix (RG16, RG28). */
export function validerEtapeLogement(f: FormulaireAnnonce): ErreursAnnonce {
  const e: ErreursAnnonce = {}
  const titre = f.titre.trim()
  if (titre.length < 5) e.titre = 'Le titre doit avoir au moins 5 caractères.'
  else if (titre.length > LIMITES.titre) e.titre = `Le titre ne dépasse pas ${LIMITES.titre} caractères.`
  const description = f.description.trim()
  if (description.length < 20) e.description = 'Décris le logement en 20 caractères au moins.'
  else if (description.length > LIMITES.description) e.description = `La description ne dépasse pas ${LIMITES.description} caractères.`

  const part = lireEntier(f.partMensuelle)
  if (part === null || part <= 0) e.partMensuelle = 'Indique un montant en FCFA, supérieur à 0.'

  const places = lireEntier(f.nbPlaces)
  if (f.type === 'place_colocation') {
    if (places === null || places < 2 || places > 12) e.nbPlaces = 'Indique le nombre de places du logement, entre 2 et 12.'
    const total = lireEntier(f.loyerTotal)
    if (total === null || total <= 0) e.loyerTotal = 'Indique le loyer total du logement en FCFA.'
    else if (part !== null && total < part) e.loyerTotal = 'Le loyer total ne peut pas être inférieur à ta part mensuelle.'
  } else {
    if (places === null || places < 1 || places > 12) e.nbPlaces = 'Indique un nombre de places entre 1 et 12.'
  }
  if (f.type !== 'place_colocation' && f.loyerTotal.trim() !== '') {
    const total = lireEntier(f.loyerTotal)
    if (total === null || total <= 0) e.loyerTotal = 'Montant invalide.'
  }
  if (!f.chargesIncluses && f.montantCharges.trim() !== '' && lireEntier(f.montantCharges) === null) {
    e.montantCharges = 'Montant invalide.'
  }
  if (f.quartierId === '') e.quartierId = 'Choisis le quartier.'
  return e
}

/** Étape 5 : colocataire recherché et contact (RG33). */
export function validerEtapeColocataire(f: FormulaireAnnonce): ErreursAnnonce {
  const e: ErreursAnnonce = {}
  const min = f.ageMin.trim() === '' ? null : lireEntier(f.ageMin)
  const max = f.ageMax.trim() === '' ? null : lireEntier(f.ageMax)
  if (f.ageMin.trim() !== '' && (min === null || min < 16 || min > 99)) e.ageMin = 'Âge entre 16 et 99.'
  if (f.ageMax.trim() !== '' && (max === null || max < 16 || max > 99)) e.ageMax = 'Âge entre 16 et 99.'
  if (!e.ageMin && !e.ageMax && min !== null && max !== null && min > max) e.ageMax = 'L\'âge maximum doit être supérieur à l\'âge minimum.'
  const dmin = f.dureeMin.trim() === '' ? null : lireEntier(f.dureeMin)
  const dmax = f.dureeMax.trim() === '' ? null : lireEntier(f.dureeMax)
  if (f.dureeMin.trim() !== '' && (dmin === null || dmin < 1 || dmin > 120)) e.dureeMin = 'Durée en mois, entre 1 et 120.'
  if (f.dureeMax.trim() !== '' && (dmax === null || dmax < 1 || dmax > 120)) e.dureeMax = 'Durée en mois, entre 1 et 120.'
  if (!e.dureeMin && !e.dureeMax && dmin !== null && dmax !== null && dmin > dmax) e.dureeMax = 'La durée maximale doit être supérieure à la durée minimale.'
  return e
}

/** Étape 4 : règles et tâches (RG30, RG31). Les lignes vides sont ignorées à l'enregistrement. */
export function validerEtapeRegles(regles: LigneRegle[], taches: LigneTache[]): ErreursAnnonce {
  const e: ErreursAnnonce = {}
  const utiles = regles.filter((r) => r.texte.trim() !== '')
  if (utiles.length > LIMITES.regles) e.regles = `${LIMITES.regles} règles au maximum.`
  else if (utiles.some((r) => r.texte.trim().length < 2 || r.texte.trim().length > LIMITES.regleCaracteres)) {
    e.regles = `Chaque règle fait entre 2 et ${LIMITES.regleCaracteres} caractères.`
  }
  const tachesUtiles = taches.filter((t) => t.libelle.trim() !== '')
  if (tachesUtiles.length > LIMITES.taches) e.taches = `${LIMITES.taches} tâches au maximum.`
  else if (tachesUtiles.some((t) => t.libelle.trim().length < 2 || t.libelle.trim().length > 80)) {
    e.taches = 'Chaque tâche fait entre 2 et 80 caractères.'
  }
  return e
}

/** Format de la part estimée d'un groupe (RG37) et affichage des montants : « 45 000 ». */
export function formaterMontant(montant: number): string {
  return new Intl.NumberFormat('fr-FR').format(montant).replace(/[  ]/g, ' ')
}
