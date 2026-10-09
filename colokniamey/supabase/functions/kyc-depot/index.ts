// Edge Function kyc-depot (module K, RG53, RG55, RG58, RGP03, RGP22).
// Reçoit une image de dossier d'identité déjà préparée par le navigateur (EnvoiPhoto en mode privé : signature,
// WebP sans EXIF ni GPS, empreinte dHash), la chiffre en AES-256-GCM et l'écrit dans le bucket privé kyc_prives.
// Aucune image n'est jamais publiée. Elle sait aussi annuler un dossier : retrait du consentement et effacement immédiat.
//
// Entrées :
//  { action: 'deposer', verification_id: uuid, type: 'recto' | 'verso' | 'selfie', image: base64, empreinte: 16 hexa }
//  { action: 'annuler' }

import { chiffrer, importerCle } from '../_shared/chiffrement.ts'
import { ErreurHttp, servir, uuid } from '../_shared/securite.ts'

const BUCKET = 'kyc_prives'
const TAILLE_IMAGE_MAX = 3 * 1024 * 1024
const TYPES = ['recto', 'verso', 'selfie']

// Signature du fichier (RG48) : JPEG, PNG ou WebP, jamais l'extension
function typeImageValide(o: Uint8Array): boolean {
  const jpeg = o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff
  const png = o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47
  const webp =
    o[0] === 0x52 && o[1] === 0x49 && o[2] === 0x46 && o[3] === 0x46 && o[8] === 0x57 && o[9] === 0x45 && o[10] === 0x42 && o[11] === 0x50
  return jpeg || png || webp
}

function messageSql(error: { code?: string; message?: string }): ErreurHttp {
  // Les messages levés par nos fonctions SQL (P0001) sont en français et sans détail technique
  return error.code === 'P0001' ? new ErreurHttp(400, error.message ?? 'Action impossible.') : new ErreurHttp(500, 'Une erreur est survenue.')
}

servir(
  ['etudiant', 'proprietaire'],
  async ({ user, client, admin, corps }) => {
    if (corps.action === 'annuler') {
      // 1. Retrait du consentement, avec les droits de l'appelant
      const { error } = await client.rpc('annuler_kyc')
      if (error) throw messageSql(error)
      // 2. Effacement immédiat des images de cette personne
      const { data: lots, error: erreurLots } = await admin.rpc('kyc_images_a_effacer', { p_uid: user.id })
      if (erreurLots || !lots) throw new Error('lecture impossible')
      const chemins = lots.flatMap((l: { chemins: string[] }) => l.chemins)
      if (chemins.length > 0) {
        const { error: erreurSuppression } = await admin.storage.from(BUCKET).remove(chemins)
        if (erreurSuppression) throw new Error('suppression impossible')
        await admin.rpc('kyc_marquer_effacees', { p_ids: lots.map((l: { id: string }) => l.id) })
      }
      return { ok: true }
    }

    if (corps.action !== 'deposer') throw new ErreurHttp(400, 'Requête invalide.')
    const verificationId = uuid(corps.verification_id, 'verification_id')
    const type = corps.type
    if (typeof type !== 'string' || !TYPES.includes(type)) throw new ErreurHttp(400, 'Champ invalide : type.')
    const empreinte = corps.empreinte
    if (typeof empreinte !== 'string' || !/^[0-9a-f]{16}$/.test(empreinte)) throw new ErreurHttp(400, 'Champ invalide : empreinte.')
    if (typeof corps.image !== 'string' || corps.image.length === 0) throw new ErreurHttp(400, 'Champ invalide : image.')

    let octets: Uint8Array
    try {
      octets = Uint8Array.from(atob(corps.image), (c) => c.charCodeAt(0))
    } catch {
      throw new ErreurHttp(400, 'Champ invalide : image.')
    }
    if (octets.length > TAILLE_IMAGE_MAX) throw new ErreurHttp(413, 'Image trop volumineuse.')
    if (!typeImageValide(octets)) throw new ErreurHttp(400, "Ce fichier n'est pas une photo JPEG, PNG ou WebP.")

    // Contrôles de la base : KYC actif, consentement donné, dossier ouvert, quota
    const { error: erreurPreparation } = await admin.rpc('kyc_preparer_depot', { p_uid: user.id, p_verification: verificationId })
    if (erreurPreparation) throw messageSql(erreurPreparation)

    const cle = await importerCle(Deno.env.get('KYC_CLE'))
    const chiffre = await chiffrer(cle, octets)
    const chemin = `${user.id}/${verificationId}/${type}.bin`
    const { error: erreurEnvoi } = await admin.storage
      .from(BUCKET)
      .upload(chemin, chiffre, { contentType: 'application/octet-stream', upsert: true })
    if (erreurEnvoi) throw new Error('envoi impossible')

    const { error: erreurEnregistrement } = await admin.rpc('kyc_enregistrer_image', {
      p_uid: user.id,
      p_verification: verificationId,
      p_type: type,
      p_chemin: chemin,
      p_empreinte: empreinte,
    })
    if (erreurEnregistrement) {
      await admin.storage.from(BUCKET).remove([chemin])
      throw messageSql(erreurEnregistrement)
    }
    return { ok: true }
  },
  // 3 Mio d'image en base64 (+ 33 %) et l'enveloppe JSON
  { tailleMax: 4_300_000 },
)
