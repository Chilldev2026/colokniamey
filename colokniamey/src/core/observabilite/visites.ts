// Suivi des visites sans donnée personnelle (RGA18) : chemin sans paramètres, type d'appareil,
// identifiant de session aléatoire. Ni IP ni traceur tiers.

import { idSession } from './session'

export type Appareil = 'mobile' | 'tablette' | 'ordinateur'

export function typeAppareil(largeur: number): Appareil {
  if (largeur < 768) return 'mobile'
  if (largeur < 1024) return 'tablette'
  return 'ordinateur'
}

/** Chemin sans paramètres de requête ni fragment. */
export function cheminSansParametres(chemin: string): string {
  return chemin.split('?')[0]!.split('#')[0]!
}

type EnvoiVisite = (chemin: string, appareil: Appareil, session: string) => Promise<void>

export function enregistrerVisite(chemin: string, envoyer: EnvoiVisite): void {
  void envoyer(cheminSansParametres(chemin), typeAppareil(window.innerWidth), idSession()).catch(
    () => undefined,
  )
}
