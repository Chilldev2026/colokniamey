import { describe, expect, it, vi, beforeEach } from 'vitest'
import { decrireRequete } from '../observabilite/decrireRequete'
import { nettoyerMessage } from '../observabilite/erreurs'
import { cheminSansParametres, typeAppareil } from '../observabilite/visites'
import {
  _tailleTampon,
  configurerMesures,
  enregistrerMesure,
  vider,
  type Mesure,
} from '../observabilite/mesures'

describe('decrireRequete', () => {
  it('nomme les appels RPC sans les paramètres', () => {
    expect(decrireRequete('https://x.supabase.co/rest/v1/rpc/verifier_quota?a=1', 'POST')).toBe('rpc:verifier_quota')
  })
  it('ne mesure pas les envois de mesures eux-mêmes', () => {
    expect(decrireRequete('https://x.supabase.co/rest/v1/rpc/enregistrer_mesures', 'POST')).toBeNull()
  })
  it('nomme une table sans exposer les filtres', () => {
    expect(decrireRequete('https://x.supabase.co/rest/v1/annonces?id=eq.12', 'get')).toBe('GET table:annonces')
  })
  it('reconnaît auth, storage et fonctions', () => {
    expect(decrireRequete('https://x.supabase.co/auth/v1/token', 'POST')).toBe('auth')
    expect(decrireRequete('https://x.supabase.co/storage/v1/object/a', 'POST')).toBe('storage')
    expect(decrireRequete('https://x.supabase.co/functions/v1/core-envoyer-email', 'POST')).toBe(
      'fonction:core-envoyer-email',
    )
  })
})

describe('nettoyerMessage (RGA19)', () => {
  it('retire les e-mails, jetons, numéros et paramètres', () => {
    const brut = 'Échec pour a.b@mail.com avec eyJabc.def.ghi tel +227 85 81 20 69 sur /x?token=1'
    const net = nettoyerMessage(brut)
    expect(net).not.toContain('@')
    expect(net).not.toContain('eyJ')
    expect(net).not.toContain('85 81')
    expect(net).not.toContain('token')
  })
  it('limite la longueur à 300 caractères', () => {
    expect(nettoyerMessage('a'.repeat(1000)).length).toBe(300)
  })
})

describe('visites (RGA18)', () => {
  it('retire les paramètres de requête et le fragment', () => {
    expect(cheminSansParametres('/annonces?q=secret#haut')).toBe('/annonces')
  })
  it('classe les appareils selon la largeur', () => {
    expect(typeAppareil(390)).toBe('mobile')
    expect(typeAppareil(800)).toBe('tablette')
    expect(typeAppareil(1440)).toBe('ordinateur')
  })
})

describe('mesures par lots (RGA25)', () => {
  beforeEach(async () => {
    configurerMesures(async () => undefined)
    await vider()
  })

  const mesure = { module: 'core', operation: 'rpc:x', duree_ms: 12.7, succes: true }

  it('ignore une mesure non échantillonnée', () => {
    enregistrerMesure(mesure, () => 0.99)
    expect(_tailleTampon()).toBe(0)
  })

  it('garde une mesure échantillonnée puis envoie le lot', async () => {
    const envoi = vi.fn<(lot: Mesure[], session: string) => Promise<void>>(async () => undefined)
    configurerMesures(envoi)
    enregistrerMesure(mesure, () => 0)
    expect(_tailleTampon()).toBe(1)
    await vider()
    expect(envoi).toHaveBeenCalledOnce()
    expect(envoi.mock.calls[0]?.[0]).toEqual([{ ...mesure, duree_ms: 13 }])
    expect(_tailleTampon()).toBe(0)
  })
})
