// Edge Function securite-photos-decision (RG49, RG50, RGP21, RGP22).
// Un admin valide ou refuse une photo en attente :
//  - la décision, le journal (RGA06) et la notification de l'auteur sont faits par la fonction SQL
//    decider_photo(), qui exige un admin actif avec un jeton aal2 (RGA04) ;
//  - cette fonction déplace ensuite le fichier : copie vers photos_publiques si validée,
//    suppression du fichier en attente dans tous les cas.
// photos_publiques n'accepte aucune écriture d'utilisateur : seule cette fonction y écrit, avec service_role.
//
// Entrée : { photo_id: nombre, decision: 'valider' | 'refuser', motif?: texte (obligatoire si refus) }

import { ErreurHttp, servir, texteBorne } from '../_shared/securite.ts'

const BUCKET_ATTENTE = 'photos_en_attente'
const BUCKET_PUBLIC = 'photos_publiques'

servir(['admin', 'super_admin'], async ({ client, admin, corps }) => {
  const photoId = corps.photo_id
  if (typeof photoId !== 'number' || !Number.isSafeInteger(photoId) || photoId <= 0) {
    throw new ErreurHttp(400, 'Champ invalide : photo_id.')
  }
  const decision = corps.decision
  if (decision !== 'valider' && decision !== 'refuser') {
    throw new ErreurHttp(400, 'Champ invalide : decision.')
  }
  const motif = decision === 'refuser' ? texteBorne(corps.motif, 'motif', 3, 300) : null

  // 1. Décision en base, avec les droits de l'appelant (est_admin() contrôle le rôle et aal2)
  const { data: chemin, error } = await client.rpc('decider_photo', {
    p_photo_id: photoId,
    p_decision: decision,
    p_motif: motif,
  })
  if (error || typeof chemin !== 'string') {
    // Les messages levés par nos fonctions SQL (code P0001) sont en français et sans détail technique
    if (error?.code === 'P0001') throw new ErreurHttp(400, error.message)
    throw new Error('decider_photo a échoué')
  }

  // 2. Déplacement du fichier avec service_role
  try {
    if (decision === 'valider') {
      const { data: fichier, error: erreurLecture } = await admin.storage.from(BUCKET_ATTENTE).download(chemin)
      if (erreurLecture || !fichier) throw new Error('lecture impossible')
      const { error: erreurCopie } = await admin.storage
        .from(BUCKET_PUBLIC)
        .upload(chemin, fichier, { contentType: fichier.type || 'image/webp', upsert: true })
      if (erreurCopie) throw new Error('copie impossible')
    }
    // Dans tous les cas le fichier en attente est supprimé (minimisation, RGP01)
    await admin.storage.from(BUCKET_ATTENTE).remove([chemin])
  } catch {
    // Le fichier n'a pas pu être déplacé : on remet la photo en attente pour qu'un admin recommence
    const { data: photo } = await admin.from('photos').select('proprietaire_id').eq('id', photoId).maybeSingle()
    await admin
      .from('photos')
      .update({ statut: 'en_attente', motif: null, decide_par: null, decide_le: null })
      .eq('id', photoId)
    if (photo) {
      const { data: derniere } = await admin
        .from('notifications')
        .select('id')
        .eq('destinataire_id', photo.proprietaire_id)
        .eq('type', 'photo_decision')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (derniere) await admin.from('notifications').delete().eq('id', derniere.id)
    }
    throw new ErreurHttp(500, 'Le déplacement du fichier a échoué. Réessaie.')
  }

  return { ok: true, statut: decision === 'valider' ? 'validee' : 'refusee' }
})
