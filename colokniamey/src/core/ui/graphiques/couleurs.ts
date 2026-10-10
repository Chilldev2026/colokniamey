// Couleurs des séries des graphiques (module D, validées pour le daltonisme), dans cet ordre.
// Gris pour une catégorie « autres, refusées ou retirées ».
export const COULEURS_SERIES = ['#3A66B0', '#E0731F', '#3E9B6B', '#B05A9A'] as const
export const COULEUR_AUTRES = '#8A93A3'

export function couleurSerie(index: number): string {
  return COULEURS_SERIES[index % COULEURS_SERIES.length] ?? COULEUR_AUTRES
}
