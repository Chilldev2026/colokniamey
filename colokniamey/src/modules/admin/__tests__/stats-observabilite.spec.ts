// A1 et A6 : graphiques partagés, export CSV, tableaux de bord, journal d'audit, erreurs, supervision.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>(),
}))

vi.mock('@/core/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
// Chart.js a besoin d'un vrai canvas : on le remplace par un simple marqueur pour tester nos composants
vi.mock('vue-chartjs', () => ({
  Line: { props: ['data', 'options'], template: '<canvas class="courbe" :data-series="data.datasets.length" :data-tension="data.datasets[0].tension" :data-largeur="data.datasets[0].borderWidth" :data-legende="options.plugins.legend.display" :data-echelles="Object.keys(options.scales).join(\',\')" />' },
  Doughnut: { props: ['data', 'options'], template: '<canvas class="anneau" :data-total="data.datasets[0].data.reduce((a, b) => a + b, 0)" :data-couleurs="data.datasets[0].backgroundColor.join(\',\')" />' },
}))

import { definirRoleCourant } from '@/core/acces'
import { parametres } from '@/core/parametres'
import GraphiqueCirculaire from '@/core/ui/graphiques/GraphiqueCirculaire.vue'
import GraphiqueCourbe from '@/core/ui/graphiques/GraphiqueCourbe.vue'
import { COULEURS_SERIES, COULEUR_AUTRES, couleurSerie } from '@/core/ui/graphiques/couleurs'
import { versCsv } from '@/core/ui/graphiques/csv'
import { familleNavigateur, nettoyerPile } from '@/core/observabilite/erreurs'
import { construireMenu } from '../menu'
import { routesEnfantsAdmin } from '../routes'
import { comparerDetails } from '../audit/services/auditService'
import ErreursView from '../erreurs/views/ErreursView.vue'
import JournalView from '../audit/views/JournalView.vue'
import SupervisionView from '../supervision/views/SupervisionView.vue'
import MaFileView from '../tableau-de-bord/views/MaFileView.vue'
import VueEnsembleView from '../tableau-de-bord/views/VueEnsembleView.vue'

const global = { stubs: { RouterLink: { template: '<a><slot /></a>' } } }

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.rpc.mockReset()
  parametres.value.kyc_actif = false
})

describe('graphiques partagés (module D)', () => {
  it('suivent la charte : couleurs dans l\'ordre, gris pour « autres »', () => {
    expect(COULEURS_SERIES).toEqual(['#3A66B0', '#E0731F', '#3E9B6B', '#B05A9A'])
    expect(couleurSerie(1)).toBe('#E0731F')
    expect(couleurSerie(4)).toBe('#3A66B0')
    expect(COULEUR_AUTRES).toBe('#8A93A3')
  })

  it('la courbe a une tension de 0,35, un trait de 2 px et une seule échelle verticale', () => {
    const w = mount(GraphiqueCourbe, { props: { titre: 'Visites', etiquettes: ['1 oct.', '2 oct.'], series: [{ nom: 'Visites', valeurs: [3, 5] }] } })
    const c = w.find('canvas')
    expect(c.attributes('data-tension')).toBe('0.35')
    expect(c.attributes('data-largeur')).toBe('2')
    expect(c.attributes('data-echelles')).toBe('y,x')
    expect(c.attributes('data-legende')).toBe('false') // légende seulement dès deux séries
  })

  it('affiche la légende dès deux séries et un tableau des valeurs sous le graphique', () => {
    const w = mount(GraphiqueCourbe, {
      props: { titre: 'Inscriptions', etiquettes: ['1 oct.', '2 oct.'], series: [{ nom: 'Étudiants', valeurs: [3, 5] }, { nom: 'Propriétaires', valeurs: [1, 0] }] },
    })
    expect(w.find('canvas').attributes('data-legende')).toBe('true')
    const lignes = w.findAll('tbody tr').map((l) => l.findAll('th, td').map((c) => c.text()))
    expect(lignes).toEqual([['1 oct.', '3', '1'], ['2 oct.', '5', '0']])
    expect(w.text()).toContain('Voir les valeurs')
  })

  it('l\'anneau montre le total au centre, une légende avec les valeurs et un tableau', () => {
    const w = mount(GraphiqueCirculaire, {
      props: { titre: 'Annonces par statut', parts: [{ libelle: 'Publiées', valeur: 7 }, { libelle: 'En attente', valeur: 2 }, { libelle: 'Refusées', valeur: 1, autres: true }] },
    })
    expect(w.find('.centre strong').text()).toBe('10')
    expect(w.findAll('.legende li').map((l) => l.text())).toEqual(['Publiées7', 'En attente2', 'Refusées1'])
    expect(w.find('canvas').attributes('data-couleurs')).toBe('#3A66B0,#E0731F,#8A93A3')
    const lignes = w.findAll('tbody tr')
    expect(lignes[lignes.length - 1]?.findAll('th, td').map((c) => c.text())).toEqual(['Total', '10'])
  })
})

describe('export CSV', () => {
  it('sépare par « ; », entoure les textes à risque et neutralise les formules (injection CSV)', () => {
    const csv = versCsv([['Nom', 'Valeur'], ['=1+1', 3], ['a;b', 'dit "oui"'], ['@cmd', null]])
    expect(csv.startsWith('﻿Nom;Valeur\r\n')).toBe(true)
    expect(csv).toContain("'=1+1;3")
    expect(csv).toContain('"a;b";"dit ""oui"""')
    expect(csv).toContain("'@cmd;")
  })
})

describe('nettoyage des erreurs (RGA19)', () => {
  it('retire e-mails, jetons et paramètres de la pile, et la limite à 2000 caractères', () => {
    const pile = nettoyerPile('Error: x\n at f (https://site/app.js?token=secret:1:2)\n contact a@b.com')
    expect(pile).not.toContain('secret')
    expect(pile).not.toContain('a@b.com')
    expect(nettoyerPile('a\n'.repeat(5000))?.length).toBeLessThanOrEqual(2000)
    expect(nettoyerPile(undefined)).toBeNull()
  })
  it('ne garde que la famille du navigateur', () => {
    expect(familleNavigateur('Mozilla/5.0 Chrome/120.0 Safari/537.36')).toBe('Chrome')
    expect(familleNavigateur('Mozilla/5.0 Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Edge')
    expect(familleNavigateur('Mozilla/5.0 Firefox/121.0')).toBe('Firefox')
    expect(familleNavigateur('inconnu')).toBe('Autre')
  })
})

describe('accueils par rôle et menus (RGA26)', () => {
  it('chaque rôle a son accueil et ses pages réservées', () => {
    const super_ = construireMenu(routesEnfantsAdmin, 'super_admin').map((e) => e.libelle)
    const admin = construireMenu(routesEnfantsAdmin, 'admin').map((e) => e.libelle)
    expect(super_).toEqual(expect.arrayContaining(["Vue d'ensemble", 'Supervision technique', 'Erreurs', "Journal d'audit"]))
    expect(super_).not.toContain('Ma file de travail')
    expect(super_).not.toContain('Mon historique')
    expect(admin).toEqual(expect.arrayContaining(['Ma file de travail', 'Mon historique']))
    for (const interdit of ["Vue d'ensemble", 'Supervision technique', 'Erreurs', "Journal d'audit"]) expect(admin).not.toContain(interdit)
  })
})

describe('Vue d\'ensemble du super-admin (A1)', () => {
  const jours = [{ jour: '2026-10-08', visites: 4, sessions: 2 }, { jour: '2026-10-09', visites: 6, sessions: 3 }]
  beforeEach(() => {
    mocks.rpc.mockImplementation((nom) => {
      const donnees: Record<string, unknown> = {
        stats_utilisateurs: { total: 40, par_role: { etudiant: 30, proprietaire: 9, super_admin: 1 }, par_statut: {}, inscriptions: [{ jour: '2026-10-08', etudiant: 2, proprietaire: 1 }, { jour: '2026-10-09', etudiant: 1, proprietaire: 0 }], nouveaux_periode: 5, nouveaux_periode_precedente: 3 },
        stats_annonces: { total: 20, par_statut: { publiee: 12, en_attente: 4, refusee: 2, brouillon: 2 }, par_type: {}, par_quartier: [{ quartier: 'Plateau', annonces: 5 }], delai_moyen_validation_heures: 6.5, publiees_periode: 8, publiees_periode_precedente: 5 },
        stats_visites: { par_jour: jours, aujourdhui: { visites: 6, sessions: 3 }, hier: { visites: 4, sessions: 2 }, pages: [], appareils: {} },
        stats_moderation: { annonces_en_attente: 4, signalements_nouveaux: 2, signalements_en_cours: 1, photos_en_attente: 0, contenus_en_attente: 0, identites_en_attente: 0, par_jour: [] },
        stats_erreurs: { ouvertes: 3, nouvelles_24h: 1, occurrences_24h: 9 },
      }
      return Promise.resolve({ data: donnees[nom] ?? null, error: null })
    })
  })

  it('affiche les tuiles cliquables avec leurs valeurs et l\'évolution', async () => {
    const w = mount(VueEnsembleView, { global })
    await flushPromises()
    const texte = w.text()
    expect(texte).toContain('Utilisateurs')
    expect(w.findAll('.tuiles .carte')).toHaveLength(6)
    expect(texte).toContain('+2 par rapport à la période précédente')
    expect(texte).toContain('Délai moyen de validation : 6.5 h')
    expect(w.find('.attention').text()).toContain('Annonces en attente')
    expect(w.findAll('.courbe')).toHaveLength(2)
    expect(w.findAll('.anneau')).toHaveLength(2)
    expect(mocks.rpc).toHaveBeenCalledWith('stats_visites', { p_jours: 30 })
  })

  it('recharge pour 7, 30 ou 90 jours et propose l\'export CSV', async () => {
    const w = mount(VueEnsembleView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === '90 jours')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('stats_annonces', { p_jours: 90 })
    expect(w.findAll('button').map((b) => b.text())).toContain('Exporter en CSV')
  })

  it('affiche l\'erreur de la base (refus pour un non super-admin)', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Action non autorisée.' } })
    const w = mount(VueEnsembleView, { global })
    await flushPromises()
    expect(w.text()).toContain('Action non autorisée')
    expect(w.findAll('.carte')).toHaveLength(0)
  })
})

describe('Ma file de travail de l\'admin (A1)', () => {
  const file = (extra: Record<string, unknown> = {}) => ({
    annonces_en_attente: 3, annonce_la_plus_ancienne: new Date(Date.now() - 2 * 3600000).toISOString(), prochaine_annonce: { id: 9, titre: 'Studio calme' },
    photos_en_attente: 2, photo_la_plus_ancienne: new Date(Date.now() - 3600000).toISOString(), contenus_en_attente: 1, signalements_nouveaux: 1, signalements_en_cours: 2,
    signalement_le_plus_ancien: null, identites_en_attente: 4, par_jour: [{ jour: '2026-10-09', recues: 5, traitees: 3 }], ...extra,
  })

  it('montre les compteurs, la prochaine annonce et ne cache aucune file active', async () => {
    mocks.rpc.mockResolvedValue({ data: file(), error: null })
    const w = mount(MaFileView, { global })
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('stats_moderation', { p_jours: 30 })
    expect(mocks.rpc).toHaveBeenCalledTimes(1) // aucune statistique de la plateforme entière
    expect(w.text()).toContain('7 demande(s) attendent ta décision')
    expect(w.text()).toContain('Studio calme')
    expect(w.text()).not.toContain('Identités à vérifier') // KYC désactivé : file masquée (RG59)
  })

  it('affiche la file des identités seulement quand le KYC est actif', async () => {
    parametres.value.kyc_actif = true
    mocks.rpc.mockResolvedValue({ data: file(), error: null })
    const w = mount(MaFileView, { global })
    await flushPromises()
    expect(w.text()).toContain('Identités à vérifier')
  })

  it('félicite quand la file est vide', async () => {
    mocks.rpc.mockResolvedValue({ data: file({ annonces_en_attente: 0, photos_en_attente: 0, contenus_en_attente: 0, signalements_nouveaux: 0, prochaine_annonce: null, identites_en_attente: 0 }), error: null })
    const w = mount(MaFileView, { global })
    await flushPromises()
    expect(w.text()).toContain('Rien n\'attend ta décision')
  })
})

describe('Journal d\'audit et Mon historique (A6)', () => {
  const ligne = (id: number, extra: Record<string, unknown> = {}) => ({
    id, created_at: '2026-10-09T10:00:00Z', acteur_id: 'a1', acteur_prenom: 'Awa', action: 'modification_parametre', cible_type: 'parametre', cible_id: 'photos_max',
    details: { ancien: 5, nouveau: 8 }, ...extra,
  })

  it('compare avant et après quand les détails le permettent', () => {
    expect(comparerDetails({ ancien: 5, nouveau: 8 })).toEqual({ avant: 5, apres: 8 })
    expect(comparerDetails({ avant: 'a', apres: 'b' })).toEqual({ avant: 'a', apres: 'b' })
    expect(comparerDetails({ statut: 'x' })).toBeNull()
  })

  it('le super-admin a les filtres, le détail avant/après et l\'export, sans aucun bouton de modification', async () => {
    definirRoleCourant('super_admin')
    mocks.rpc.mockImplementation((nom) =>
      Promise.resolve({
        data: nom === 'filtres_journal' ? { actions: ['modification_parametre'], cibles: ['parametre'], acteurs: [{ id: 'a1', prenom: 'Awa' }] } : [ligne(1), ligne(2, { action: 'annonce_validee', details: {} })],
        error: null,
      }),
    )
    const w = mount(JournalView, { global })
    await flushPromises()
    expect(w.text()).toContain('Journal d\'audit')
    expect(w.text()).toContain('Admin')
    expect(w.findAll('button').map((b) => b.text())).toContain('Exporter en CSV')
    await w.find('button.action').trigger('click')
    expect(w.find('.comparaison').text()).toContain('5')
    expect(w.find('.comparaison').text()).toContain('8')
    const textes = w.findAll('button').map((b) => b.text().toLowerCase())
    expect(textes.some((t) => /supprimer|modifier|effacer/.test(t))).toBe(false)
    definirRoleCourant(null)
  })

  it('l\'admin voit « Mon historique » sans filtre d\'acteur ni export', async () => {
    definirRoleCourant('admin')
    mocks.rpc.mockResolvedValue({ data: [ligne(1)], error: null })
    const w = mount(JournalView, { global })
    await flushPromises()
    expect(w.text()).toContain('Mon historique')
    expect(w.text()).not.toContain('Exporter en CSV')
    expect(mocks.rpc.mock.calls.some((c) => c[0] === 'filtres_journal')).toBe(false)
    expect(w.find('label[for]').exists()).toBe(true)
    expect(w.findAll('select')).toHaveLength(0)
    definirRoleCourant(null)
  })
})

describe('Erreurs (A6)', () => {
  const erreur = { id: 4, message: 'TypeError : x est indéfini', module: 'annonces', page: '/annonces/3', occurrences: 12, statut: 'nouveau', premiere_vue: '2026-10-01T10:00:00Z', derniere_vue: '2026-10-09T10:00:00Z', pile: 'at f (app.js:1)', navigateur: 'Chrome', version: '2026-10-09' }

  it('liste les erreurs groupées, montre la pile et change le statut', async () => {
    mocks.rpc.mockResolvedValue({ data: [erreur], error: null })
    const w = mount(ErreursView, { global })
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('liste_erreurs', { p_jours: 30 })
    expect(w.text()).toContain('12 fois')
    await w.find('button.ligne').trigger('click')
    expect(w.text()).toContain('at f (app.js:1)')
    expect(w.text()).toContain('Chrome')
    await w.find('.detail select').setValue('resolu')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('changer_statut_erreur', { p_id: 4, p_statut: 'resolu' })
  })
})

describe('Supervision (A6)', () => {
  const donnees = {
    periode: '24h',
    requetes: { total: 120, pages_vues: 40, par_pas: [{ t: '2026-10-09T10:00:00Z', requetes: 60, pages_vues: 20 }, { t: '2026-10-09T11:00:00Z', requetes: 60, pages_vues: 20 }], par_module: [{ module: 'annonces', requetes: 80 }] },
    erreurs: { taux_global_pct: 2.5, par_module: [{ module: 'annonces', requetes: 80, erreurs: 2, taux_pct: 2.5 }], pages_en_echec: [{ page: '/annonces/3', occurrences: 4 }] },
    latence: { global: { p50: 120, p95: 800, p99: 1500 }, par_module: [{ module: 'annonces', p50: 120, p95: 800, p99: 1500 }] },
    saturation: { base_mo: 45.2, limite_base_mo: 500, base_pct: 9, stockage_mo: 450, limite_stockage_mo: 500, stockage_pct: 90, connexions: 12, limite_connexions: 60, connexions_pct: 20, limite_appels_edge: 500000, seuil_alerte_pct: 80 },
  }
  beforeEach(() => {
    mocks.rpc.mockImplementation((nom) =>
      Promise.resolve({ data: nom === 'supervision' ? donnees : [{ cle: 'erreurs_pct', valeur: 5 }, { cle: 'p95_ms', valeur: 3000 }], error: null }),
    )
  })

  it('montre les quatre indicateurs avec P50, P95, P99 et une alerte visuelle de saturation', async () => {
    const w = mount(SupervisionView, { global })
    await flushPromises()
    const texte = w.text()
    for (const titre of ['1. Requêtes', '2. Erreurs', '3. Temps de réponse', '4. Saturation']) expect(texte).toContain(titre)
    expect(texte).toContain('P50 120 ms')
    expect(texte).toContain('P95 800 ms')
    expect(texte).toContain('P99 1500 ms')
    expect(texte).toContain('2.5 %')
    expect(w.findAll('.barre.alerte')).toHaveLength(1) // le stockage à 90 % dépasse 80 %
    expect(w.findAll('[role="progressbar"]')).toHaveLength(3)
  })

  it('change de période et enregistre un seuil', async () => {
    const w = mount(SupervisionView, { global })
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === '7 jours')!.trigger('click')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('supervision', { p_periode: '7j' })
    const champ = w.findAll('input')[0]!
    await champ.setValue('10')
    await w.findAll('form')[0]!.trigger('submit')
    await flushPromises()
    expect(mocks.rpc).toHaveBeenCalledWith('definir_seuil', { p_cle: 'erreurs_pct', p_valeur: 10 })
  })

  it('refuse un seuil invalide sans appeler la base', async () => {
    const w = mount(SupervisionView, { global })
    await flushPromises()
    await w.findAll('input')[0]!.setValue('abc')
    await w.findAll('form')[0]!.trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('nombre supérieur à 0')
    expect(mocks.rpc.mock.calls.some((c) => c[0] === 'definir_seuil')).toBe(false)
  })
})
