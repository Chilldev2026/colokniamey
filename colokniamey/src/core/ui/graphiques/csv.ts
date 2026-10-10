// Export CSV des statistiques (réservé au super-admin). Les cellules qui commencent par = + - @ sont neutralisées pour
// qu'un tableur n'exécute jamais une formule venue de données saisies par un utilisateur (injection CSV).

export type CelluleCsv = string | number | null | undefined

function cellule(valeur: CelluleCsv): string {
  let texte = valeur === null || valeur === undefined ? '' : String(valeur)
  if (typeof valeur === 'string' && /^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`
  return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
}

/** Texte CSV (séparateur « ; » pour les tableurs en français), avec marque d'ordre des octets pour l'UTF-8. */
export function versCsv(lignes: CelluleCsv[][]): string {
  return '﻿' + lignes.map((l) => l.map(cellule).join(';')).join('\r\n') + '\r\n'
}

export function telechargerCsv(nom: string, lignes: CelluleCsv[][]): void {
  const blob = new Blob([versCsv(lignes)], { type: 'text/csv;charset=utf-8' })
  const adresse = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = adresse
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(adresse)
}
