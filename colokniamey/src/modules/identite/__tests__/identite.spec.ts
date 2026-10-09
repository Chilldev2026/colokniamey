// K : chiffrement des images, parcours étudiant, désactivation par défaut (RG59), file admin, menu.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
  invoke: vi.fn<(nom: string, options?: unknown) => Promise<{ data: unknown; error: unknown }>>(),
}))

vi.mock('@/core/supabase', () => ({
  supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke }, storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://x/avatar.webp' } }) }) } },
}))

import { definirRoleCourant } from '@/core/acces'
import { parametres } from '@/core/parametres'
import { chiffrer, dechiffrer, importerCle } from '../../../../supabase/functions/_shared/chiffrement'
import { construireMenu } from '@/modules/admin/menu'
import { routesEnfantsAdmin } from '@/modules/admin/routes'
import IdentitesView from '@/modules/admin/identites/views/IdentitesView.vue'
import BadgeIdentite from '../components/BadgeIdentite.vue'
import BandeauIdentite from '../components/BandeauIdentite.vue'
import SelfieDirect from '../components/SelfieDirect.vue'
import VerifierIdentiteView from '../views/VerifierIdentiteView.vue'
import { etapeCourante, type EtatAvatarKyc, type EtatKyc } from '../types'

function cleBase64(octet: number): string {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(octet)))
}

const etatVide: EtatKyc = {
  verificationId: null, statut: 'non_soumis', motifRefus: null, typePiece: null, codeSelfie: null, consentement: false,
  recto: false, verso: false, selfie: false, decideLe: null, verifiee: false, dossiersRestants: 3,
}
const avatarOk: EtatAvatarKyc = { valide: true, enAttente: false, refusee: false, motif: null }

describe('chiffrement AES-256-GCM des images (RGP03)', () => {
  const image = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

  it('chiffre puis déchiffre avec la même clé', async () => {
    const cle = await importerCle(cleBase64(7))
    const stocke = await chiffrer(cle, image)
    expect(Array.from(await dechiffrer(cle, stocke))).toEqual(Array.from(image))
  })

  it('ne laisse rien de lisible : le fichier stocké ne contient pas l\'image', async () => {
    const cle = await importerCle(cleBase64(7))
    const stocke = await chiffrer(cle, image)
    expect(stocke.length).toBeGreaterThan(image.length)
    expect(Array.from(stocke).join(',')).not.toContain(Array.from(image).join(','))
    // pas d'en-tête d'image reconnaissable (RIFF)
    expect(Array.from(stocke.slice(0, 4))).not.toEqual([0x52, 0x49, 0x46, 0x46])
  })

  it('utilise un vecteur d\'initialisation différent à chaque fichier', async () => {
    const cle = await importerCle(cleBase64(7))
    const a = await chiffrer(cle, image)
    const b = await chiffrer(cle, image)
    expect(Array.from(a.slice(1, 13))).not.toEqual(Array.from(b.slice(1, 13)))
  })

  it('refuse de déchiffrer avec une autre clé : le fichier est illisible sans la bonne clé', async () => {
    const stocke = await chiffrer(await importerCle(cleBase64(7)), image)
    await expect(dechiffrer(await importerCle(cleBase64(8)), stocke)).rejects.toThrow('Déchiffrement impossible.')
  })

  it('détecte un fichier modifié', async () => {
    const cle = await importerCle(cleBase64(7))
    const stocke = await chiffrer(cle, image)
    stocke[stocke.length - 1] = (stocke[stocke.length - 1] ?? 0) ^ 1
    await expect(dechiffrer(cle, stocke)).rejects.toThrow('Déchiffrement impossible.')
  })

  it('refuse une clé absente ou de mauvaise longueur', async () => {
    await expect(importerCle(undefined)).rejects.toThrow('Clé de chiffrement absente.')
    await expect(importerCle(btoa('trop court'))).rejects.toThrow('Clé de chiffrement invalide.')
    await expect(importerCle('pas du base64 !')).rejects.toThrow('Clé de chiffrement invalide.')
  })
})

describe('étape affichée selon le dossier (RG51, RG53)', () => {
  it('sans photo de profil validée : étape 1', () => {
    expect(etapeCourante(etatVide, { ...avatarOk, valide: false })).toBe('photo')
  })
  it('sans consentement : étape 2 ; pièce incomplète : étape 2', () => {
    expect(etapeCourante(etatVide, avatarOk)).toBe('piece')
    expect(etapeCourante({ ...etatVide, consentement: true, recto: true }, avatarOk)).toBe('piece')
  })
  it('pièce envoyée : selfie ; puis envoi', () => {
    const piece = { ...etatVide, consentement: true, recto: true, verso: true }
    expect(etapeCourante(piece, avatarOk)).toBe('selfie')
    expect(etapeCourante({ ...piece, selfie: true }, avatarOk)).toBe('envoi')
  })
})

describe('menu admin : file Identités masquée tant que kyc_actif est faux (RG59)', () => {
  it('n\'affiche pas Identités par défaut, l\'affiche une fois le KYC activé', () => {
    expect(construireMenu(routesEnfantsAdmin, 'admin').map((e) => e.libelle)).not.toContain('Identités')
    expect(construireMenu(routesEnfantsAdmin, 'admin', { kyc_actif: false }).map((e) => e.libelle)).not.toContain('Identités')
    expect(construireMenu(routesEnfantsAdmin, 'admin', { kyc_actif: true }).map((e) => e.libelle)).toContain('Identités')
    expect(construireMenu(routesEnfantsAdmin, 'super_admin', { kyc_actif: true }).map((e) => e.libelle)).toContain('Identités')
  })
  it('la route est réservée aux admins', () => {
    const route = routesEnfantsAdmin.find((r) => r.path === 'identites')
    expect(route?.meta?.roles).toEqual(['admin', 'super_admin'])
  })
})

function simulerRpc(kyc: Partial<EtatKyc> & { code?: string }, avatar: Partial<EtatAvatarKyc> = {}) {
  mocks.rpc.mockImplementation((nom) => {
    if (nom === 'mon_kyc') {
      const e = { ...etatVide, ...kyc }
      return Promise.resolve({
        data: [{
          verification_id: e.verificationId, statut: e.statut, motif_refus: e.motifRefus, type_piece: e.typePiece,
          code_selfie: kyc.code ?? e.codeSelfie, consentement: e.consentement, recto: e.recto, verso: e.verso, selfie: e.selfie,
          decide_le: e.decideLe, verifiee: e.verifiee, dossiers_restants: e.dossiersRestants,
        }],
        error: null,
      })
    }
    if (nom === 'mon_avatar') {
      const a = { ...avatarOk, ...avatar }
      return Promise.resolve({ data: [{ chemin_valide: a.valide ? 'x/a.webp' : null, statut: a.enAttente ? 'en_attente' : a.refusee ? 'refusee' : a.valide ? 'validee' : null, motif: a.motif }], error: null })
    }
    if (nom === 'demarrer_kyc') return Promise.resolve({ data: [{ verification_id: 'v1', code: '1234' }], error: null })
    return Promise.resolve({ data: null, error: null })
  })
}

describe('parcours étudiant', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.rpc.mockReset()
    mocks.invoke.mockReset()
    definirRoleCourant('etudiant')
  })
  afterEach(() => {
    definirRoleCourant(null)
    parametres.value.kyc_actif = false
  })

  it('KYC désactivé : aucun écran de vérification et aucun appel à la base (RG59)', async () => {
    parametres.value.kyc_actif = false
    const w = mount(VerifierIdentiteView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('pas demandée')
    expect(w.find('input[type="file"]').exists()).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('le bandeau et le badge restent invisibles quand le KYC est désactivé', async () => {
    parametres.value.kyc_actif = false
    const bandeau = mount(BandeauIdentite, { global: { stubs: { RouterLink: true } } })
    const badge = mount(BadgeIdentite, { props: { userId: 'u1' } })
    await flushPromises()
    expect(bandeau.text()).toBe('')
    expect(badge.text()).toBe('')
    expect(mocks.rpc).not.toHaveBeenCalled()
    badge.unmount()
    bandeau.unmount()
  })

  it('bandeau visible pour un étudiant non vérifié quand le KYC est actif ; invisible une fois vérifié', async () => {
    parametres.value.kyc_actif = true
    simulerRpc({ verifiee: false })
    const non = mount(BandeauIdentite, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    expect(non.text()).toContain('Vérifie ton identité')
    simulerRpc({ verifiee: true })
    const oui = mount(BandeauIdentite, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(oui.text()).toBe('')
  })

  it('le bandeau ne concerne pas un propriétaire tant que kyc_proprietaires est faux', async () => {
    parametres.value.kyc_actif = true
    parametres.value.kyc_proprietaires = false
    definirRoleCourant('proprietaire')
    simulerRpc({ verifiee: false })
    const w = mount(BandeauIdentite, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toBe('')
  })

  it('étape 1 : sans photo de profil validée, pas de dépôt (RG51)', async () => {
    parametres.value.kyc_actif = true
    simulerRpc({}, { valide: false })
    const w = mount(VerifierIdentiteView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    expect(w.text()).toContain('Ta photo de profil')
    expect(w.find('input[type="file"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Accepter et continuer')
  })

  it('étape 2 : le consentement est demandé avant tout envoi d\'image (RG53)', async () => {
    parametres.value.kyc_actif = true
    simulerRpc({})
    const w = mount(VerifierIdentiteView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('J\'accepte que mes images soient traitées')
    expect(w.find('input[type="file"]').exists()).toBe(false)
    const bouton = w.findAll('button').find((b) => b.text().includes('Accepter et continuer'))!
    expect(bouton.attributes('disabled')).toBeDefined()
    await w.find('input[type="checkbox"]').setValue(true)
    expect(bouton.attributes('disabled')).toBeUndefined()
    await bouton.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('demarrer_kyc')
    expect(mocks.rpc).toHaveBeenCalledWith('consentir_kyc')
  })

  it('étape 2 après consentement : pièce recto et verso, puis suite bloquée tant qu\'il manque une face', async () => {
    parametres.value.kyc_actif = true
    simulerRpc({ verificationId: 'v1', consentement: true, recto: true })
    const w = mount(VerifierIdentiteView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('Recto')
    expect(w.text()).toContain('Verso')
    const suite = w.findAll('button').find((b) => b.text() === 'Continuer')!
    expect(suite.attributes('disabled')).toBeDefined()
  })

  it('étape 3 : le selfie se prend en direct, sans aucun import de fichier (RG53)', async () => {
    parametres.value.kyc_actif = true
    simulerRpc({ verificationId: 'v1', consentement: true, recto: true, verso: true, code: '4821' })
    const w = mount(VerifierIdentiteView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('4821')
    expect(w.find('input[type="file"]').exists()).toBe(false)
    expect(w.text()).toContain('Ouvrir la caméra')
  })

  it('SelfieDirect n\'a pas de champ de fichier', () => {
    const w = mount(SelfieDirect, { props: { code: '1234' } })
    expect(w.find('input').exists()).toBe(false)
    expect(w.text()).toContain('1234')
  })

  it('en attente : on peut annuler, et l\'annulation passe par kyc-depot qui efface les images', async () => {
    parametres.value.kyc_actif = true
    simulerRpc({ statut: 'en_attente', verificationId: 'v1', consentement: true, recto: true, verso: true, selfie: true })
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })
    const w = mount(VerifierIdentiteView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('en cours d\'examen')
    await w.findAll('button').find((b) => b.text().includes('Annuler mon dossier'))!.trigger('click')
    await flushPromises()
    expect(mocks.invoke).toHaveBeenCalledWith('kyc-depot', { body: { action: 'annuler' } })
  })

  it('refusé : le motif est montré, avec « Envoyer un nouveau dossier » tant qu\'il reste des dossiers possibles', async () => {
    parametres.value.kyc_actif = true
    simulerRpc({ statut: 'refuse', motifRefus: 'Photo floue', dossiersRestants: 2 })
    const w = mount(VerifierIdentiteView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('Photo floue')
    expect(w.text()).toContain('Envoyer un nouveau dossier')
    simulerRpc({ statut: 'refuse', motifRefus: 'Photo floue', dossiersRestants: 0 })
    const w2 = mount(VerifierIdentiteView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w2.text()).not.toContain('Envoyer un nouveau dossier')
  })

  it('validé puis modifié (nom, prénom, photo) : invité à refaire un dossier (RG57)', async () => {
    parametres.value.kyc_actif = true
    simulerRpc({ statut: 'valide', verifiee: false })
    const w = mount(VerifierIdentiteView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('n\'est plus vérifiée')
  })
})

describe('file admin des identités (RG54, RG55)', () => {
  const ligne = { id: 'v1', prenom: 'Aïcha', nom: 'Moussa', type_piece: 'cni', statut: 'en_attente', suspect: true, soumis_le: '2026-10-01T10:00:00Z', decide_le: null }
  const fiche = { id: 'v1', prenom: 'Aïcha', nom: 'Moussa', avatar_chemin: 'u/a.webp', type_piece: 'cni', code_selfie: '4821', statut: 'en_attente', suspect: true, soumis_le: '2026-10-01T10:00:00Z', motif_refus: null, images_disponibles: true }

  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.rpc.mockReset()
    mocks.invoke.mockReset()
    parametres.value.kyc_actif = true
    definirRoleCourant('admin')
    mocks.rpc.mockImplementation((nom) => {
      if (nom === 'liste_dossiers_kyc') return Promise.resolve({ data: [ligne], error: null })
      if (nom === 'dossier_kyc_admin') return Promise.resolve({ data: [fiche], error: null })
      return Promise.resolve({ data: null, error: null })
    })
    URL.createObjectURL = vi.fn<(objet: Blob | MediaSource) => string>(() => 'blob:image')
    URL.revokeObjectURL = vi.fn<(adresse: string) => void>()
  })
  afterEach(() => {
    definirRoleCourant(null)
    parametres.value.kyc_actif = false
  })

  it('liste le dossier avec l\'alerte « déjà vu ailleurs » et montre le code attendu', async () => {
    const w = mount(IdentitesView)
    await flushPromises()
    expect(w.text()).toContain('Aïcha Moussa')
    expect(w.text()).toContain('Déjà vu ailleurs')
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('4821')
    expect(w.text()).toContain('ressemble à une image déjà vue')
  })

  it('Valider est bloqué tant que les images n\'ont pas été affichées ; l\'affichage passe par kyc-consulter', async () => {
    mocks.invoke.mockResolvedValue({ data: new Blob(['x']), error: null })
    const w = mount(IdentitesView)
    await flushPromises()
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    const valider = () => w.findAll('button').find((b) => b.text() === 'Valider')!
    expect(valider().attributes('disabled')).toBeDefined()
    await w.findAll('button').find((b) => b.text().includes('Afficher les images'))!.trigger('click')
    await flushPromises()
    expect(mocks.invoke).toHaveBeenCalledTimes(3)
    expect(mocks.invoke).toHaveBeenCalledWith('kyc-consulter', { body: { verification_id: 'v1', image: 'recto' } })
    expect(valider().attributes('disabled')).toBeUndefined()
    await valider().trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('decider_kyc', { p_id: 'v1', p_valide: true })
  })

  it('un refus exige un motif, même sur l\'écran', async () => {
    mocks.invoke.mockResolvedValue({ data: new Blob(['x']), error: null })
    const w = mount(IdentitesView, { attachTo: document.body })
    await flushPromises()
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Refuser')!.trigger('click')
    await flushPromises()
    const confirmer = Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Refuser').pop()!
    expect(confirmer.disabled).toBe(true)
    w.unmount()
  })

  it('masque le résultat d\'un échec de kyc-consulter sans afficher de détail technique', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('boom') })
    const w = mount(IdentitesView)
    await flushPromises()
    await w.find('button.ligne').trigger('click')
    await flushPromises()
    await w.findAll('button').find((b) => b.text().includes('Afficher les images'))!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('n\'a pas pu être chargée')
    expect(w.text()).not.toContain('boom')
  })
})
