// Edge Function kyc-consulter (module K, RG55, RGP10, RGP22).
// Un admin consulte une image d'un dossier d'identité :
//  - la fonction SQL autoriser_consultation_kyc() exige un admin actif en aal2 avec une session admin valide,
//    journalise la consultation, puis renvoie le chemin du fichier ;
//  - l'image est déchiffrée ici et renvoyée directement (aucune URL, publique ou signée), jamais mise en cache.
//
// Entrée : { verification_id: uuid, image: 'recto' | 'verso' | 'selfie' }

import { dechiffrer, importerCle } from '../_shared/chiffrement.ts'
import { ErreurHttp, servir, uuid } from '../_shared/securite.ts'

servir(['admin', 'super_admin'], async ({ client, admin, corps }) => {
  const verificationId = uuid(corps.verification_id, 'verification_id')
  const image = corps.image
  if (image !== 'recto' && image !== 'verso' && image !== 'selfie') throw new ErreurHttp(400, 'Champ invalide : image.')

  const { data: chemin, error } = await client.rpc('autoriser_consultation_kyc', { p_id: verificationId, p_image: image })
  if (error || typeof chemin !== 'string') {
    if (error?.code === 'P0001') throw new ErreurHttp(400, error.message)
    throw new Error('autorisation impossible')
  }

  const { data: fichier, error: erreurLecture } = await admin.storage.from('kyc_prives').download(chemin)
  if (erreurLecture || !fichier) throw new ErreurHttp(404, "Cette image n'est plus disponible.")

  const cle = await importerCle(Deno.env.get('KYC_CLE'))
  const clair = await dechiffrer(cle, new Uint8Array(await fichier.arrayBuffer()))

  // octet-stream : supabase-js renvoie alors un Blob ; le navigateur n'interprète rien (nosniff)
  return new Response(clair, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
