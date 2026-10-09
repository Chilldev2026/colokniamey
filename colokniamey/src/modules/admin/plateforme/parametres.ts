// Définition des paramètres modifiables dans l'écran Paramètres (RGA17) et lecture typée d'une saisie.
// Ces contrôles servent au confort : la base (modifier_parametre) revalide chaque valeur.

export type TypeParametre = 'booleen' | 'entier' | 'decimal' | 'texte'

export interface DefinitionParametre {
  cle: string
  libelle: string
  aide: string
  type: TypeParametre
  min?: number
  max?: number
  unite?: string
}

export interface GroupeParametres {
  titre: string
  description?: string
  parametres: DefinitionParametre[]
}

export const GROUPES_PARAMETRES: GroupeParametres[] = [
  {
    titre: 'Inscriptions et annonces',
    parametres: [
      { cle: 'inscriptions_ouvertes', libelle: 'Inscriptions ouvertes', aide: 'Si c\'est non, plus personne ne peut créer de compte.', type: 'booleen' },
      { cle: 'validation_annonces', libelle: 'Validation des annonces par un admin', aide: 'Si c\'est oui, une annonce n\'est publiée qu\'après validation (RG17).', type: 'booleen' },
    ],
  },
  {
    titre: 'Photos',
    parametres: [
      { cle: 'photos_max', libelle: 'Nombre de photos par annonce', aide: 'Entre 1 et 10.', type: 'entier', min: 1, max: 10 },
      { cle: 'photo_taille_max_mo', libelle: 'Taille maximale d\'une photo', aide: 'Avant compression.', type: 'entier', min: 1, max: 20, unite: 'Mo' },
      { cle: 'photo_dimension_min', libelle: 'Dimension minimale', aide: 'Côté le plus court.', type: 'entier', min: 100, max: 2000, unite: 'pixels' },
      { cle: 'nsfw_seuil', libelle: 'Seuil de refus des photos explicites', aide: 'Entre 0,3 et 1. Plus il est bas, plus le filtre est strict. La validation humaine reste le vrai garde-fou.', type: 'decimal', min: 0.3, max: 1 },
    ],
  },
  {
    titre: 'Sessions',
    parametres: [
      { cle: 'inactivite_etudiant_jours', libelle: 'Déconnexion des étudiants après', aide: 'Jours sans activité.', type: 'entier', min: 1, max: 90, unite: 'jours' },
      { cle: 'inactivite_proprietaire_jours', libelle: 'Déconnexion des propriétaires après', aide: 'Jours sans activité.', type: 'entier', min: 1, max: 90, unite: 'jours' },
    ],
  },
  {
    titre: 'Conditions d\'utilisation',
    parametres: [
      { cle: 'version_cgu', libelle: 'Version des conditions en vigueur', aide: 'Changer cette valeur oblige tout le monde à accepter à nouveau les conditions (RGP12).', type: 'texte' },
    ],
  },
  {
    titre: 'Vérification d\'identité',
    description: 'Le KYC est développé mais désactivé par défaut (RG59). L\'activer fait apparaître les écrans de dépôt de pièce et la file Identités.',
    parametres: [
      { cle: 'kyc_actif', libelle: 'Vérification d\'identité des étudiants', aide: 'Réservé au super-admin. Chaque changement est journalisé.', type: 'booleen' },
      { cle: 'kyc_proprietaires', libelle: 'Vérification d\'identité des propriétaires', aide: 'Étend le KYC aux propriétaires.', type: 'booleen' },
    ],
  },
  {
    titre: 'Notifications et relances',
    parametres: [
      { cle: 'email_domaine_verifie', libelle: 'Domaine d\'envoi d\'e-mails vérifié', aide: 'À mettre sur oui seulement quand un domaine est vérifié chez Resend : les e-mails peuvent alors partir de l\'application.', type: 'booleen' },
      { cle: 'heure_recapitulatif', libelle: 'Heure du récapitulatif quotidien', aide: 'Heure UTC (7 = 8 h à Niamey).', type: 'entier', min: 0, max: 23, unite: 'h UTC' },
      { cle: 'seuil_relance_heures', libelle: 'Ancienneté qui déclenche une nouvelle alerte', aide: 'Un élément en attente depuis plus longtemps relance les admins.', type: 'entier', min: 1, max: 168, unite: 'heures' },
    ],
  },
]

export type ResultatLecture = { valeur: boolean | number | string } | { erreur: string }

/** Transforme la saisie de l'écran en valeur JSON, ou explique pourquoi elle est refusée. */
export function lireValeur(definition: DefinitionParametre, saisie: string | boolean): ResultatLecture {
  switch (definition.type) {
    case 'booleen':
      return { valeur: saisie === true || saisie === 'true' }
    case 'texte': {
      const texte = String(saisie).trim()
      return texte === '' ? { erreur: 'Cette valeur est obligatoire.' } : { valeur: texte }
    }
    case 'entier':
    case 'decimal': {
      const brut = String(saisie).trim().replace(',', '.')
      if (brut === '' || Number.isNaN(Number(brut))) return { erreur: 'Entre un nombre.' }
      const nombre = Number(brut)
      if (definition.type === 'entier' && !Number.isInteger(nombre)) return { erreur: 'Entre un nombre entier.' }
      if (definition.min !== undefined && nombre < definition.min) return { erreur: `Le minimum est ${definition.min}.` }
      if (definition.max !== undefined && nombre > definition.max) return { erreur: `Le maximum est ${definition.max}.` }
      return { valeur: nombre }
    }
  }
}

export function afficherValeur(definition: DefinitionParametre, valeur: unknown): string {
  if (definition.type === 'booleen') return valeur === true ? 'Oui' : 'Non'
  const texte = String(valeur ?? '-')
  return definition.unite ? `${texte} ${definition.unite}` : texte
}
