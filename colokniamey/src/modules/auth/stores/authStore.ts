// Store de l'authentification : session, profil, restauration au démarrage, inactivité (RGP28).

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/core/supabase'
import { definirRoleCourant } from '@/core/acces'
import { chargerParametres, parametres } from '@/core/parametres'
import {
  demarrerInactivite,
  effacerInactivite,
  inactiviteDepassee,
  reinitialiserInactivite,
} from '@/core/useInactivite'
import * as service from '../services/authService'
import type { Profil, RaisonDeconnexion } from '../types'
import type { DonneesInscription } from '../validation'

const JOUR_MS = 86_400_000

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const profil = ref<Profil | null>(null)
  const raisonDeconnexion = ref<RaisonDeconnexion>(null)
  // RGA08 : motif communiqué à la personne dont le compte est suspendu
  const motifSuspension = ref<string | null>(null)
  const pret = ref(false)
  let arreterInactivite: (() => void) | null = null

  const estConnecte = computed(() => session.value !== null && profil.value !== null)
  const role = computed(() => profil.value?.role ?? null)
  // RGP12 : vrai si la version acceptée est la version en vigueur
  const cguAJour = computed(() => profil.value === null || profil.value.cgu_version === parametres.value.version_cgu)

  /** RGP28 : délai d'inactivité de la personne connectée, ou null si aucun contrôle (admins : voir A2). */
  function delaiInactiviteMs(): number | null {
    if (profil.value?.role === 'etudiant') return parametres.value.inactivite_etudiant_jours * JOUR_MS
    if (profil.value?.role === 'proprietaire') return parametres.value.inactivite_proprietaire_jours * JOUR_MS
    return null
  }

  async function viderEtat() {
    session.value = null
    profil.value = null
    definirRoleCourant(null)
    arreterInactivite?.()
    arreterInactivite = null
    effacerInactivite()
  }

  /** Ferme la session et mémorise pourquoi, pour l'écran de connexion. */
  async function fermerSession(raison: RaisonDeconnexion) {
    // Le signOut ne doit jamais bloquer : on vide l'état même si le réseau échoue
    await supabase.auth.signOut().catch(() => undefined)
    await viderEtat()
    raisonDeconnexion.value = raison
  }

  async function appliquerSession(nouvelle: Session | null) {
    if (!nouvelle) {
      await viderEtat()
      return
    }
    session.value = nouvelle
    const lu = await service.lireProfil(nouvelle.user.id).catch(() => null)
    if (!lu) {
      // Session sans profil lisible : on n'affiche rien de connecté
      await viderEtat()
      return
    }
    // RG08 : un compte suspendu ou désactivé n'entre pas
    if (lu.statut !== 'actif') {
      await fermerSession('suspendu')
      motifSuspension.value = lu.motif_suspension
      return
    }
    profil.value = lu
    definirRoleCourant(lu.role)
  }

  /** Démarrage : restaure la session, contrôle l'inactivité AVANT tout affichage (RGP28). */
  async function initialiser(): Promise<void> {
    await chargerParametres()
    const { data } = await supabase.auth.getSession()
    await appliquerSession(data.session)

    const delai = delaiInactiviteMs()
    if (profil.value && delai !== null && inactiviteDepassee(delai)) {
      await fermerSession('inactivite')
    } else if (profil.value) {
      demarrerSuiviInactivite()
    }

    // Réaction aux changements de session (connexion dans un autre onglet, expiration, déconnexion).
    // Le rappel reste synchrone : les appels à Supabase partent après coup pour éviter un blocage.
    supabase.auth.onAuthStateChange((evenement, nouvelle) => {
      if (evenement === 'INITIAL_SESSION' || evenement === 'TOKEN_REFRESHED') return
      window.setTimeout(() => {
        void appliquerSession(nouvelle).then(() => {
          if (evenement === 'SIGNED_IN' && profil.value) demarrerSuiviInactivite()
        })
      }, 0)
    })
    pret.value = true
  }

  function demarrerSuiviInactivite() {
    arreterInactivite?.()
    arreterInactivite = demarrerInactivite({
      delaiMs: delaiInactiviteMs,
      surExpiration: () => void fermerSession('inactivite'),
    })
  }

  async function connecter(email: string, motDePasse: string, captchaToken: string) {
    raisonDeconnexion.value = null
    motifSuspension.value = null
    await service.connecter(email, motDePasse, captchaToken)
    reinitialiserInactivite()
    // La mise à jour de l'état passe aussi par onAuthStateChange ; on charge tout de suite pour rediriger
    const { data } = await supabase.auth.getSession()
    await appliquerSession(data.session)
    if (profil.value) demarrerSuiviInactivite()
  }

  async function inscrire(donnees: DonneesInscription, captchaToken: string) {
    await service.inscrire(donnees, captchaToken, parametres.value.version_cgu)
  }

  async function demanderReinitialisation(email: string, captchaToken: string) {
    await service.demanderReinitialisation(email, captchaToken)
  }

  /** Après la réinitialisation, on ferme la session ouverte par le lien et on repart de la connexion. */
  async function changerMotDePasse(motDePasse: string) {
    await service.changerMotDePasse(motDePasse)
    await fermerSession(null)
  }

  async function deconnecter() {
    await service.deconnecter()
    await viderEtat()
  }

  async function deconnecterPartout() {
    await service.deconnecterPartout()
    await viderEtat()
  }

  /** À appeler après une modification du profil (nom, prénom) pour mettre l'état à jour. */
  async function rafraichirProfil() {
    if (session.value) await appliquerSession(session.value)
  }

  /** Après une désactivation : la session est déjà détruite côté serveur, on vide seulement l'état local. */
  async function fermerSessionLocale() {
    await fermerSession(null)
  }

  async function accepterCgu() {
    await service.accepterCgu(parametres.value.version_cgu)
    if (session.value) await appliquerSession(session.value)
  }

  return {
    session,
    profil,
    raisonDeconnexion,
    motifSuspension,
    pret,
    estConnecte,
    role,
    cguAJour,
    initialiser,
    inscrire,
    demanderReinitialisation,
    changerMotDePasse,
    connecter,
    deconnecter,
    deconnecterPartout,
    accepterCgu,
    rafraichirProfil,
    fermerSessionLocale,
  }
})
