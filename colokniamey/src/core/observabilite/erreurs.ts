// Capture des erreurs de l'application (RGA19), sans donnée sensible.
// La fonction reçoit l'envoi en paramètre pour rester testable.

import { idSession } from './session'
import { lireModuleCourant } from './contexte'

export interface DetailErreur {
  pile: string | null
  navigateur: string
  version: string
}

type EnvoiErreur = (message: string, module: string, page: string, session: string, detail: DetailErreur) => Promise<void>

/** Retire ce qui pourrait être une donnée personnelle ou un secret (RGA19, RGP10). */
export function nettoyerMessage(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jeton]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[nombre]')
    .replace(/\?[^\s"')]*/g, '')
    .slice(0, 300)
}

/** Pile d'appels nettoyée ligne par ligne (mêmes règles que le message), limitée à 2000 caractères (RGA19). */
export function nettoyerPile(pile: string | undefined): string | null {
  if (!pile) return null
  return pile.split('\n').map((ligne) => nettoyerMessage(ligne)).join('\n').slice(0, 2000)
}

/** Famille du navigateur seulement (aucune version précise, aucun identifiant d'appareil). */
export function familleNavigateur(agent: string): string {
  if (/Edg\//.test(agent)) return 'Edge'
  if (/OPR\/|Opera/.test(agent)) return 'Opera'
  if (/Firefox\//.test(agent)) return 'Firefox'
  if (/Chrome\//.test(agent)) return 'Chrome'
  if (/Safari\//.test(agent)) return 'Safari'
  return 'Autre'
}

function versTexte(raison: unknown): string {
  if (raison instanceof Error) return raison.message
  if (typeof raison === 'string') return raison
  return 'Erreur inconnue'
}

export function signalerErreur(raison: unknown, envoyer: EnvoiErreur): void {
  const message = nettoyerMessage(versTexte(raison))
  const page = window.location.pathname
  // L'envoi lui-même ne doit jamais provoquer une nouvelle erreur
  const detail: DetailErreur = {
    pile: raison instanceof Error ? nettoyerPile(raison.stack) : null,
    navigateur: familleNavigateur(navigator.userAgent),
    version: typeof __VERSION_APP__ === 'string' ? __VERSION_APP__ : 'dev',
  }
  void envoyer(message, lireModuleCourant(), page, idSession(), detail).catch(() => undefined)
}

export function demarrerCaptureErreurs(
  app: import('vue').App,
  envoyer: EnvoiErreur,
): void {
  app.config.errorHandler = (erreur) => {
    signalerErreur(erreur, envoyer)
  }
  window.addEventListener('error', (e) => signalerErreur(e.error ?? e.message, envoyer))
  window.addEventListener('unhandledrejection', (e) => signalerErreur(e.reason, envoyer))
}
