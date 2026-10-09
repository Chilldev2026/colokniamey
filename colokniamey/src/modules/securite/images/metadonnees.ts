// Détection de métadonnées dans un fichier image (EXIF, position GPS, XMP).
// Sert aux tests et au contrôle de ce que produit le ré-encodage (RG48) : une image sortie d'un canvas
// ne doit plus contenir aucun de ces blocs.

function contient(octets: Uint8Array, texte: string): boolean {
  const motif = Array.from(texte, (c) => c.charCodeAt(0))
  for (let i = 0; i <= octets.length - motif.length; i++) {
    if (motif.every((v, j) => octets[i + j] === v)) return true
  }
  return false
}

/** Vrai si le fichier contient un bloc EXIF, GPS ou XMP (JPEG : « Exif », PNG : « eXIf », WebP : « EXIF » / « XMP »). */
export function contientMetadonnees(octets: Uint8Array): boolean {
  return ['Exif', 'eXIf', 'EXIF', 'XMP ', 'http://ns.adobe.com/xap', 'GPS'].some((m) => contient(octets, m))
}
