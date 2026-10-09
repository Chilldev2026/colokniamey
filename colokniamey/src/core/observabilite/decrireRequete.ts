// Transforme l'adresse d'un appel Supabase en un nom d'opération sans donnée personnelle.
// Exemples : /rest/v1/rpc/verifier_quota -> « rpc:verifier_quota », /rest/v1/annonces?id=eq.12 -> « table:annonces ».
// Les paramètres de requête ne sont jamais conservés (RGA18, RGP10).

export function decrireRequete(adresse: string, methode: string): string | null {
  let chemin: string
  try {
    chemin = new URL(adresse, 'http://local').pathname
  } catch {
    return null
  }

  const rpc = /^\/rest\/v1\/rpc\/([a-z0-9_]+)/i.exec(chemin)
  if (rpc?.[1]) {
    // Les envois de mesures ne sont pas mesurés eux-mêmes (éviterait une boucle)
    if (rpc[1].startsWith('enregistrer_')) return null
    return `rpc:${rpc[1]}`
  }

  const table = /^\/rest\/v1\/([a-z0-9_]+)/i.exec(chemin)
  if (table?.[1]) return `${methode.toUpperCase()} table:${table[1]}`

  if (chemin.startsWith('/auth/v1/')) return 'auth'
  if (chemin.startsWith('/storage/v1/')) return 'storage'
  const fonction = /^\/functions\/v1\/([a-z0-9_-]+)/i.exec(chemin)
  if (fonction?.[1]) return `fonction:${fonction[1]}`
  return null
}
