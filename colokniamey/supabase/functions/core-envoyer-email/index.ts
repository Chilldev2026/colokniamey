// Edge Function envoyer-email (module M0), préfixée « core- ».
// RGA30 : e-mail automatique UNIQUEMENT au super-admin tant que email_domaine_verifie est faux
// (Resend sans domaine vérifié n'écrit qu'à l'adresse du compte Resend).
// RGA33 : aucune donnée personnelle dans le contenu : file, nombre, ancienneté, lien.

import { ErreurHttp, servir, texteBorne, uuid } from '../_shared/securite.ts'

servir(['admin', 'super_admin'], async ({ admin, corps }) => {
  const destinataireId = uuid(corps.destinataire_id, 'destinataire_id')
  const sujet = texteBorne(corps.sujet, 'sujet', 3, 120)
  const message = texteBorne(corps.message, 'message', 3, 1000)

  // Paramètre lu avec service_role (non public)
  const { data: param } = await admin
    .from('parametres')
    .select('valeur')
    .eq('cle', 'email_domaine_verifie')
    .maybeSingle()
  const domaineVerifie = param?.valeur === true

  // Le destinataire doit être super-admin tant que le domaine n'est pas vérifié (RGA30)
  const { data: profil } = await admin
    .from('profils')
    .select('role')
    .eq('id', destinataireId)
    .maybeSingle()
  if (!domaineVerifie && profil?.role !== 'super_admin') {
    throw new ErreurHttp(403, 'Destinataire non autorisé.')
  }

  const { data: compte, error } = await admin.auth.admin.getUserById(destinataireId)
  const adresse = compte?.user?.email
  if (error || !adresse) {
    throw new ErreurHttp(404, 'Destinataire introuvable.')
  }

  const cle = Deno.env.get('RESEND_API_KEY')
  if (!cle) {
    throw new ErreurHttp(503, 'Envoi d\'e-mail non configuré.')
  }

  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'ColokNiamey <onboarding@resend.dev>',
      to: [adresse],
      subject: sujet,
      text: message,
    }),
  })
  if (!reponse.ok) {
    throw new ErreurHttp(502, 'L\'envoi de l\'e-mail a échoué.')
  }
  return { ok: true }
})
