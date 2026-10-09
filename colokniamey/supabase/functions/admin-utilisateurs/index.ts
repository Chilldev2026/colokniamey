// Edge Function admin-utilisateurs (module A2) : actions sur les comptes. RGA01 à RGA09, RGA38, RGP22.
//
// Chaque appel passe par servir() : jeton valide, compte actif, rôle admin ou super_admin, corps JSON borné.
// Ensuite cette fonction :
//  1. exige est_admin() avec le jeton de l'appelant : double authentification (aal2) faite et session admin
//     active depuis moins de 30 minutes (RGA04, RGA36) ;
//  2. appelle la fonction SQL de l'action avec le client service_role, en lui passant l'acteur. La fonction SQL
//     revérifie le rôle et les rangs (jamais sur soi-même ni sur un niveau égal ou supérieur, RGA02 ; super-admin
//     seulement pour les actions sensibles ; un super-admin actif au moins, RGA03), journalise (RGA06) et notifie ;
//  3. fait ce que seule l'API d'administration peut faire : supprimer le compte ou ses facteurs MFA.
//
// Entrée : { action, cible_id, motif?, jusqua?, role? }
//   suspendre (motif, jusqua?) | reactiver | changer_role (role) | desactiver_et_anonymiser (motif)
//   supprimer_definitivement (motif) | reinitialiser_mfa (motif)

import { ErreurHttp, servir, texteBorne, uuid } from '../_shared/securite.ts'

const ACTIONS = [
  'suspendre',
  'reactiver',
  'changer_role',
  'desactiver_et_anonymiser',
  'supprimer_definitivement',
  'reinitialiser_mfa',
] as const
type Action = (typeof ACTIONS)[number]

const ROLES_ATTRIBUABLES = ['admin', 'etudiant', 'proprietaire']

servir(['admin', 'super_admin'], async ({ client, admin, user, corps }) => {
  const action = corps.action
  if (typeof action !== 'string' || !(ACTIONS as readonly string[]).includes(action)) {
    throw new ErreurHttp(400, 'Champ invalide : action.')
  }
  const cible = uuid(corps.cible_id, 'cible_id')

  // 1. Double authentification et session active, vérifiées par la base avec le jeton de l'appelant
  const { data: autorise, error: erreurAutorisation } = await client.rpc('est_admin')
  if (erreurAutorisation || autorise !== true) {
    throw new ErreurHttp(403, 'Double authentification requise, ou session expirée par inactivité.')
  }
  // RGP20 : garde-fou contre une rafale d'actions
  const { error: erreurQuota } = await client.rpc('verifier_quota', { p_action: 'action_admin' })
  if (erreurQuota) throw new ErreurHttp(429, 'Trop d\'actions en peu de temps. Patiente un moment.')

  /** Appelle une fonction SQL d'action. Les messages de nos fonctions (code P0001) sont en français et sûrs. */
  async function appeler(fonction: string, args: Record<string, unknown>) {
    const { error } = await admin.rpc(fonction, { p_acteur: user.id, p_cible: cible, ...args })
    if (error) {
      if (error.code === 'P0001') throw new ErreurHttp(400, error.message)
      throw new Error(`${fonction} a échoué`)
    }
  }

  switch (action as Action) {
    case 'suspendre': {
      const motif = texteBorne(corps.motif, 'motif', 3, 300)
      let jusqua: string | null = null
      if (corps.jusqua !== undefined && corps.jusqua !== null && corps.jusqua !== '') {
        const date = new Date(String(corps.jusqua))
        if (Number.isNaN(date.getTime())) throw new ErreurHttp(400, 'Champ invalide : jusqua.')
        jusqua = date.toISOString()
      }
      await appeler('admin_action_suspendre', { p_motif: motif, p_jusqua: jusqua })
      break
    }
    case 'reactiver':
      await appeler('admin_action_reactiver', {})
      break
    case 'changer_role': {
      const role = corps.role
      if (typeof role !== 'string' || !ROLES_ATTRIBUABLES.includes(role)) {
        throw new ErreurHttp(400, 'Champ invalide : role.')
      }
      await appeler('admin_action_changer_role', { p_role: role })
      break
    }
    case 'desactiver_et_anonymiser':
      await appeler('admin_action_desactiver', { p_motif: texteBorne(corps.motif, 'motif', 3, 300) })
      break

    case 'supprimer_definitivement': {
      await appeler('admin_action_preparer_suppression', { p_motif: texteBorne(corps.motif, 'motif', 3, 300) })
      // Les photos de la personne sont retirées de Storage avant la suppression du compte (qui efface leurs lignes)
      const { data: photos } = await admin.from('photos').select('chemin').eq('proprietaire_id', cible)
      const chemins = (photos ?? []).map((p: { chemin: string }) => p.chemin)
      if (chemins.length > 0) {
        await admin.storage.from('photos_en_attente').remove(chemins)
        await admin.storage.from('photos_publiques').remove(chemins)
      }
      const { error } = await admin.auth.admin.deleteUser(cible)
      if (error) throw new Error('deleteUser a échoué')
      break
    }

    case 'reinitialiser_mfa': {
      await appeler('admin_action_preparer_reinit_mfa', { p_motif: texteBorne(corps.motif, 'motif', 3, 300) })
      const { data: facteurs, error: erreurListe } = await admin.auth.admin.mfa.listFactors({ userId: cible })
      if (erreurListe) throw new Error('listFactors a échoué')
      for (const facteur of facteurs.factors) {
        const { error } = await admin.auth.admin.mfa.deleteFactor({ id: facteur.id, userId: cible })
        if (error) throw new Error('deleteFactor a échoué')
      }
      break
    }
  }
  return { ok: true }
})
