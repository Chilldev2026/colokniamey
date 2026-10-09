// Capture des erreurs de l'application (RGA19), sans donnée sensible.
// La fonction reçoit l'envoi en paramètre pour rester testable.

import { idSession } from './session'
import { lireModuleCourant } from './contexte'

type EnvoiErreur = (message: string, module: string, page: string, session: string) => Promise<void>

/** Retire ce qui pourrait être une donnée personnelle ou un secret (RGA19, RGP10). */
export function nettoyerMessage(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jeton]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[nombre]')
    .replace(/\?[^\s"')]*/g, '')
    .slice(0, 300)
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
  void envoyer(message, lireModuleCourant(), page, idSession()).catch(() => undefined)
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
