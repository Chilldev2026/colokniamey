// Edge Function admin-recapitulatif (module A2) : récapitulatif quotidien par e-mail au seul super-admin
// (RGA30, RGA33, RGA34, RGA35). Appelée chaque jour par pg_cron (pg_net), jamais par un utilisateur :
// elle est protégée par un secret partagé (en-tête x-cron-secret) et non par un jeton (verify_jwt = false).
//
// Le contenu ne porte que sur les files : nom, nombre, ancienneté. Aucun nom, téléphone ni image.
// Tant que le domaine d'envoi n'est pas vérifié chez Resend, seule l'adresse du compte Resend peut recevoir
// l'e-mail : c'est celle du super-admin (RGA30).
//
// Secrets nécessaires : CRON_SECRET, RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ; APP_URL facultatif.

import { createClient } from 'npm:@supabase/supabase-js@2'

interface LigneFile {
  libelle: string
  nombre: number
  plus_ancien: string | null
  urgent: boolean
}

function egalTempsConstant(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

function ancienneté(date: string | null): string {
  if (!date) return '-'
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h` : `${minutes} min`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405 })

  const attendu = Deno.env.get('CRON_SECRET') ?? ''
  const recu = req.headers.get('x-cron-secret') ?? ''
  if (attendu.length < 16 || !egalTempsConstant(recu, attendu)) {
    return new Response('Non autorisé.', { status: 401 })
  }

  const cle = Deno.env.get('RESEND_API_KEY')
  if (!cle) return new Response(JSON.stringify({ erreur: 'Envoi d\'e-mail non configuré.' }), { status: 503 })

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data, error } = await admin.rpc('donnees_recapitulatif')
    if (error || !data) throw new Error('lecture impossible')

    const files = data.files as LigneFile[]
    const destinataires = (data.destinataires as { email: string }[]).map((d) => d.email)
    const total = files.reduce((somme, f) => somme + f.nombre, 0)
    const urgentes = files.filter((f) => f.urgent && f.nombre > 0)
    const lien = Deno.env.get('APP_URL') ? `${Deno.env.get('APP_URL')}/admin` : ''

    const lignes = [
      total === 0 ? 'Aucun élément en attente. Bonne journée !' : `${total} élément(s) en attente de décision.`,
      '',
      ...(urgentes.length > 0
        ? ['A TRAITER EN PRIORITE (en attente depuis plus de 24 h) :', ...urgentes.map((f) => `- ${f.libelle} : ${f.nombre} (le plus ancien depuis ${ancienneté(f.plus_ancien)})`), '']
        : []),
      'Files :',
      ...files.map((f) => `- ${f.libelle} : ${f.nombre}${f.nombre > 0 ? ` (le plus ancien depuis ${ancienneté(f.plus_ancien)})` : ''}`),
      ...(lien ? ['', `Espace admin (connexion et double authentification) : ${lien}`] : []),
    ]

    let envoyes = 0
    for (const email of destinataires) {
      const reponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'ColokNiamey <onboarding@resend.dev>',
          to: [email],
          subject: urgentes.length > 0 ? 'ColokNiamey : éléments à traiter en priorité' : 'ColokNiamey : récapitulatif du jour',
          text: lignes.join('\n'),
        }),
      })
      if (reponse.ok) envoyes++
    }
    return new Response(JSON.stringify({ ok: true, envoyes }), { headers: { 'Content-Type': 'application/json' } })
  } catch {
    // Erreur générique : aucun détail technique renvoyé (RGP22)
    return new Response(JSON.stringify({ erreur: 'Une erreur est survenue.' }), { status: 500 })
  }
})
