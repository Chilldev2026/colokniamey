// Liens de relance par e-mail ou WhatsApp (RGA31) : le super-admin les ouvre depuis SA messagerie ou SON WhatsApp.
// Aucune donnée personnelle dans le texte (RGA33) : le nombre d'éléments, l'ancienneté, un lien. Pas même de prénom.

/** Indicatif du Niger, appliqué aux numéros de 8 chiffres écrits sans indicatif [À VALIDER]. */
const INDICATIF_NIGER = '227'

/** Numéro au format attendu par wa.me : chiffres seulement, avec l'indicatif du pays. Null si inutilisable. */
export function numeroWhatsApp(telephone: string): string | null {
  const brut = telephone.trim()
  const chiffres = brut.replace(/\D/g, '')
  if (brut.startsWith('+')) return chiffres.length >= 8 ? chiffres : null
  if (chiffres.startsWith('00') && chiffres.length > 10) return chiffres.slice(2)
  if (chiffres.length === 8) return INDICATIF_NIGER + chiffres
  if (chiffres.startsWith(INDICATIF_NIGER) && chiffres.length === 11) return chiffres
  return null
}

/** Texte de la relance : généré à partir du résumé des files, jamais saisi librement. */
export function messageRelance(resume: string, origine: string): string {
  return `Bonjour, ${resume} Connecte-toi à l'espace admin (connexion et double authentification) : ${origine}/admin`
}

export const SUJET_RELANCE = 'ColokNiamey : des éléments attendent ta décision'

/** Lien mailto: vers un ou plusieurs admins, objet et texte préremplis. */
export function lienMailto(adresses: string[], sujet: string, corps: string): string {
  return `mailto:${adresses.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`
}

/** Lien WhatsApp prérempli, ou null si le numéro n'est pas utilisable. */
export function lienWhatsApp(telephone: string, texte: string): string | null {
  const numero = numeroWhatsApp(telephone)
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texte)}` : null
}
