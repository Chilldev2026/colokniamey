// Module actuellement affiché : permet de ranger chaque mesure par module (RGA21, RGA22).

let moduleCourant = 'core'

export function definirModuleCourant(nom: string | undefined): void {
  moduleCourant = nom ?? 'core'
}

export function lireModuleCourant(): string {
  return moduleCourant
}
