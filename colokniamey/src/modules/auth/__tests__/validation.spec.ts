import { describe, expect, it } from 'vitest'
import { traduireErreurAuth } from '../erreurs'
import { validerInscription, validerMotDePasse, validerTelephone, type DonneesInscription } from '../validation'

const valide = (): DonneesInscription => ({
  role: 'etudiant',
  email: 'aminata@example.com',
  motDePasse: 'Zebre-Violet-84',
  nom: 'Issoufou',
  prenom: 'Aminata',
  telephone: '90 12 34 56',
  universiteId: '3',
  typeProprietaire: 'particulier',
  conditionsAcceptees: true,
})

describe('mot de passe (RG04, RGP26)', () => {
  it('refuse moins de 8 caractères', () => {
    expect(validerMotDePasse('Ab1-xy')).not.toBeNull()
  })

  it('refuse un mot de passe courant', () => {
    expect(validerMotDePasse('12345678')).toMatch(/courant/)
    expect(validerMotDePasse('azertyuiop')).toMatch(/courant/)
  })

  it('refuse un mot de passe qui contient le début de l\'e-mail', () => {
    expect(validerMotDePasse('aminata-2026!', 'aminata@example.com')).not.toBeNull()
  })

  it('accepte un mot de passe long et peu courant', () => {
    expect(validerMotDePasse('Zebre-Violet-84', 'aminata@example.com')).toBeNull()
  })
})

describe('inscription (RG06, RG11, RGP12)', () => {
  it('accepte des données complètes', () => {
    expect(validerInscription(valide())).toEqual({})
  })

  it('refuse un étudiant sans université', () => {
    const erreurs = validerInscription({ ...valide(), universiteId: '' })
    expect(erreurs.universiteId).toBeDefined()
  })

  it('ne demande pas d\'université à un propriétaire', () => {
    expect(validerInscription({ ...valide(), role: 'proprietaire', universiteId: '' })).toEqual({})
  })

  it('refuse un téléphone absent ou invalide', () => {
    expect(validerTelephone('')).not.toBeNull()
    expect(validerTelephone('abc')).not.toBeNull()
    expect(validerTelephone('+227 90 12 34 56')).toBeNull()
  })

  it('exige l\'acceptation des conditions', () => {
    const erreurs = validerInscription({ ...valide(), conditionsAcceptees: false })
    expect(erreurs.conditionsAcceptees).toBeDefined()
  })
})

describe('traduction des erreurs (RGP26)', () => {
  it('donne le même message à la connexion, que l\'e-mail existe ou non', () => {
    const inconnu = traduireErreurAuth({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'connexion')
    const mauvais = traduireErreurAuth({ message: 'autre chose' }, 'connexion')
    expect(inconnu).toBe(mauvais)
    expect(inconnu).toBe('E-mail ou mot de passe incorrect.')
  })

  it('annonce un compte suspendu (RG08)', () => {
    expect(traduireErreurAuth({ code: 'user_banned', message: 'User is banned' }, 'connexion')).toMatch(/suspendu/)
  })

  it('signale un e-mail déjà utilisé à l\'inscription seulement', () => {
    expect(traduireErreurAuth({ code: 'user_already_exists', message: '' }, 'inscription')).toMatch(/déjà utilisée/)
  })

  it('reste générique au mot de passe oublié', () => {
    const a = traduireErreurAuth({ code: 'user_not_found', message: '' }, 'reinitialisation')
    const b = traduireErreurAuth({ code: 'unexpected_failure', message: '' }, 'reinitialisation')
    expect(a).toBe(b)
  })

  it('traduit l\'échec Turnstile', () => {
    expect(traduireErreurAuth({ code: 'captcha_failed', message: '' }, 'inscription')).toMatch(/anti-robots/)
  })
})
