import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'

// Faux client Supabase : chaque table renvoie ce qu'on lui a préparé, et on garde les écritures
const base = vi.hoisted(() => ({
  tables: {} as Record<string, { data: unknown; error: unknown }>,
  ecritures: [] as { table: string; operation: string; charge: Record<string, unknown> }[],
  rpc: {} as Record<string, { data: unknown; error: unknown }>,
}))

interface Chainable extends Promise<unknown> {
  select: () => Chainable
  eq: () => Chainable
  order: () => Chainable
  maybeSingle: () => Promise<unknown>
}

vi.mock('@/core/supabase', () => {
  function constructeur(table: string) {
    const resultat = () => base.tables[table] ?? { data: null, error: null }
    // Chaque appel renvoie une vraie promesse enrichie des méthodes de chaînage
    const enchainer = (): Chainable =>
      Object.assign(Promise.resolve(resultat()), {
        select: enchainer,
        eq: enchainer,
        order: enchainer,
        maybeSingle: () => Promise.resolve(resultat()),
      })
    return {
      select: enchainer,
      update: (charge: Record<string, unknown>) => {
        base.ecritures.push({ table, operation: 'update', charge })
        return enchainer()
      },
      insert: (charge: Record<string, unknown>) => {
        base.ecritures.push({ table, operation: 'insert', charge })
        return enchainer()
      },
    }
  }
  return {
    supabase: {
      from: constructeur,
      rpc: (nom: string) => Promise.resolve(base.rpc[nom] ?? { data: null, error: null }),
      storage: { from: () => ({ getPublicUrl: (c: string) => ({ data: { publicUrl: `https://stockage.test/${c}` } }) }) },
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    },
  }
})

// Les autres modules sont remplacés par des doublures simples
vi.mock('@/modules/referentiel', () => ({
  SelecteurUniversite: defineComponent({ props: ['modelValue'], template: '<span data-test="univ" />' }),
}))
vi.mock('@/modules/securite', () => ({
  EnvoiPhoto: defineComponent({ props: ['usage', 'coteMax'], template: '<span data-test="envoi-photo" />' }),
  messageErreurContenu: (e: { code?: string; message?: string } | null) => (e?.code === 'P0001' && e.message ? e.message : 'Une erreur est survenue. Réessaie dans un moment.'),
}))
vi.mock('@/modules/auth', () => ({
  LIBELLES_ROLE: { etudiant: 'Étudiant', proprietaire: 'Propriétaire', admin: 'Administrateur', super_admin: 'Super-administrateur' },
  validerTelephone: (t: string) => (/^\+?[0-9 ]{8,20}$/.test(t.trim()) ? null : 'Téléphone invalide.'),
  validerMotDePasse: () => null,
  changerMotDePasse: () => Promise.resolve(),
  useAuthStore: () => ({ session: { user: { id: 'u1', email: 'a@b.c' } }, role: 'etudiant', rafraichirProfil: () => Promise.resolve(), fermerSessionLocale: () => Promise.resolve() }),
}))

import { enregistrerProfil, lireMonProfil, lireProfilPublic, exporterMesDonnees } from '../services/profilsService'
import { lireCentresInteret, validerProfil } from '../validation'
import CarteProfilPublic from '../components/CarteProfilPublic.vue'
import MonProfilView from '../views/MonProfilView.vue'
import type { DonneesProfil } from '../types'

const donnees = (surcharge: Partial<DonneesProfil> = {}): DonneesProfil => ({
  nom: 'Issoufou', prenom: 'Aminata', telephone: '90 12 34 56', universiteId: '3', niveauEtude: 'L2',
  filiere: 'Informatique', budgetMax: '25000', bio: 'Calme', typeProprietaire: 'particulier', adresse: '',
  profession: '', centresInteret: 'Football, Lecture', ...surcharge,
})

beforeEach(() => {
  setActivePinia(createPinia())
  base.tables = {}
  base.ecritures = []
  base.rpc = {}
})

describe('validation du profil (RG10, RG11)', () => {
  it('lit les centres d\'intérêt séparés par des virgules', () => {
    expect(lireCentresInteret(' Football, Lecture ,, ')).toEqual(['Football', 'Lecture'])
  })

  it('accepte des données valides', () => {
    expect(validerProfil(donnees(), 'etudiant')).toEqual({})
  })

  it('refuse plus de 5 centres d\'intérêt, ou un centre trop court', () => {
    expect(validerProfil(donnees({ centresInteret: 'aa, bb, cc, dd, ee, ff' }), 'etudiant').centresInteret).toMatch(/5/)
    expect(validerProfil(donnees({ centresInteret: 'x' }), 'etudiant').centresInteret).toMatch(/2 et 40/)
  })

  it('exige une université pour un étudiant, pas pour un propriétaire', () => {
    expect(validerProfil(donnees({ universiteId: '' }), 'etudiant').universiteId).toBeDefined()
    expect(validerProfil(donnees({ universiteId: '' }), 'proprietaire')).toEqual({})
  })

  it('refuse un téléphone invalide et une profession trop longue', () => {
    const e = validerProfil(donnees({ telephone: 'abc', profession: 'a'.repeat(81) }), 'etudiant')
    expect(e.telephone).toBeDefined()
    expect(e.profession).toMatch(/80/)
  })
})

describe('enregistrement du profil (RG03, RG10)', () => {
  it('n\'envoie jamais le rôle, le statut ni les champs de suspension', async () => {
    base.tables.profils_complements = { data: [{ user_id: 'u1' }], error: null }
    await enregistrerProfil('u1', 'etudiant', donnees())
    const champs = base.ecritures.flatMap((e) => Object.keys(e.charge))
    for (const interdit of ['role', 'statut', 'motif_suspension', 'suspendu_jusqua', 'cgu_version', 'en_revue', 'id']) {
      expect(champs).not.toContain(interdit)
    }
    expect(base.ecritures.map((e) => e.table)).toEqual(['profils', 'profils_etudiants', 'profils_complements'])
  })

  it('crée les compléments au premier enregistrement', async () => {
    base.tables.profils_complements = { data: [], error: null }
    await enregistrerProfil('u1', 'proprietaire', donnees({ profession: 'Gérant' }))
    expect(base.ecritures[base.ecritures.length - 1]).toMatchObject({ table: 'profils_complements', operation: 'insert' })
    expect(base.ecritures[base.ecritures.length - 1]?.charge).toMatchObject({ user_id: 'u1', profession: 'Gérant', centres_interet: ['Football', 'Lecture'] })
  })

  it('montre le message français d\'un texte refusé par la base (S)', async () => {
    base.tables.profils = { data: null, error: { code: 'P0001', message: 'Ce texte ne respecte pas les règles de ColokNiamey. Modifie-le et réessaie.' } }
    await expect(enregistrerProfil('u1', 'etudiant', donnees())).rejects.toThrow(/règles de ColokNiamey/)
  })

  it('cache les erreurs techniques', async () => {
    base.tables.profils = { data: null, error: { code: '23514', message: 'new row violates check constraint "profils_nom_check"' } }
    await expect(enregistrerProfil('u1', 'etudiant', donnees())).rejects.toThrow('Une erreur est survenue. Réessaie dans un moment.')
  })
})

describe('lecture du profil', () => {
  it('assemble le profil étudiant', async () => {
    base.tables.profils = { data: { id: 'u1', role: 'etudiant', statut: 'actif', nom: 'Issoufou', prenom: 'Aminata', telephone: '90123456' }, error: null }
    base.tables.profils_etudiants = { data: { universite_id: 3, niveau_etude: null, filiere: 'Info', budget_max: 25000, bio: null }, error: null }
    base.tables.profils_complements = { data: { profession: 'Étudiante', centres_interet: ['Football'] }, error: null }
    const p = await lireMonProfil('u1')
    expect(p.etudiant).toMatchObject({ universiteId: '3', niveauEtude: '', budgetMax: '25000' })
    expect(p.proprietaire).toBeNull()
    expect(p.centresInteret).toEqual(['Football'])
  })
})

describe('profil public (RGP : jamais de téléphone ni d\'e-mail)', () => {
  it('ne rend que les champs publics', async () => {
    base.rpc.profil_public = {
      data: [{ id: 'u2', prenom: 'Zeinabou', initiale_nom: 'M', role: 'proprietaire', universite: null, type_proprietaire: 'agence',
        membre_depuis: '2026-01-05T00:00:00Z', avatar_chemin: 'u2/a.webp', profession: null, centres_interet: [] }],
      error: null,
    }
    const p = await lireProfilPublic('u2')
    expect(Object.keys(p ?? {}).sort()).toEqual(
      ['avatarChemin', 'centresInteret', 'id', 'initialeNom', 'membreDepuis', 'prenom', 'profession', 'role', 'typeProprietaire', 'universite'],
    )
  })

  it('renvoie null pour un profil indisponible', async () => {
    base.rpc.profil_public = { data: [], error: null }
    expect(await lireProfilPublic('u9')).toBeNull()
  })

  it('la carte affiche prénom et initiale, jamais le téléphone', async () => {
    base.rpc.profil_public = {
      data: [{ id: 'u1', prenom: 'Aminata', initiale_nom: 'I', role: 'etudiant', universite: 'Université Abdou Moumouni (UAM)',
        type_proprietaire: null, membre_depuis: '2026-03-01T00:00:00Z', avatar_chemin: null, profession: 'Étudiante', centres_interet: ['Football'] }],
      error: null,
    }
    const w = mount(CarteProfilPublic, { props: { userId: 'u1' } })
    await flushPromises()
    expect(w.text()).toContain('Aminata I.')
    expect(w.text()).toContain('Université Abdou Moumouni (UAM)')
    expect(w.text()).toContain('Football')
    expect(w.text()).not.toMatch(/\d{2} ?\d{2} ?\d{2}/)
  })

  it('la carte indique un profil indisponible', async () => {
    base.rpc.profil_public = { data: [], error: null }
    const w = mount(CarteProfilPublic, { props: { userId: 'u9' } })
    await flushPromises()
    expect(w.text()).toContain('plus disponible')
  })
})

describe('export des données (RGP11)', () => {
  it('rend le JSON de la fonction exporter_mes_donnees', async () => {
    base.rpc.exporter_mes_donnees = { data: { compte: { email: 'a@b.c' }, donnees: {} }, error: null }
    const json = JSON.parse(await exporterMesDonnees()) as { compte: { email: string } }
    expect(json.compte.email).toBe('a@b.c')
  })
})

describe('vue MonProfil', () => {
  function profilEtudiant() {
    base.tables.profils = { data: { id: 'u1', role: 'etudiant', statut: 'actif', nom: 'Issoufou', prenom: 'Aminata', telephone: '90123456' }, error: null }
    base.tables.profils_etudiants = { data: { universite_id: 3, niveau_etude: null, filiere: null, budget_max: null, bio: null }, error: null }
  }

  it('affiche le rôle et le statut en lecture seule et rappelle la photo obligatoire (RG51)', async () => {
    profilEtudiant()
    base.rpc.mon_avatar = { data: [{ chemin_valide: null, statut: null, motif: null }], error: null }
    const w = mount(MonProfilView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('Étudiant')
    expect(w.text()).toContain('Actif')
    expect(w.text()).toContain('obligatoire pour les étudiants')
    expect(w.text()).toContain('visage doit être visible, de face, sans filtre')
    // aucun champ pour modifier le rôle ou le statut
    const libelles = w.findAll('label').map((l) => l.text())
    expect(libelles.some((l) => /rôle|statut/i.test(l))).toBe(false)
    expect(w.find('[data-test=envoi-photo]').exists()).toBe(true)
  })

  it('n\'affiche plus le rappel quand l\'avatar est validé', async () => {
    profilEtudiant()
    base.rpc.mon_avatar = { data: [{ chemin_valide: 'u1/a.webp', statut: 'validee', motif: null }], error: null }
    const w = mount(MonProfilView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).not.toContain('obligatoire pour les étudiants')
  })

  it('montre le motif d\'un avatar refusé', async () => {
    profilEtudiant()
    base.rpc.mon_avatar = { data: [{ chemin_valide: null, statut: 'refusee', motif: 'Visage non visible' }], error: null }
    const w = mount(MonProfilView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('Visage non visible')
  })
})
