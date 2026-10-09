// Edge Function kyc-purge (module K, RG56) : efface les images KYC arrivées au terme de leur conservation
// (30 jours après la décision [À VALIDER], consentement retiré, dossier abandonné, compte désactivé).
// Appelée chaque nuit par pg_cron (pg_net), jamais par un utilisateur : protégée par le secret partagé
// x-cron-secret (verify_jwt = false), comme admin-recapitulatif.
// Secrets : CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2'

function egalTempsConstant(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405 })
  const attendu = Deno.env.get('CRON_SECRET') ?? ''
  const recu = req.headers.get('x-cron-secret') ?? ''
  if (attendu.length < 16 || !egalTempsConstant(recu, attendu)) return new Response('Non autorisé.', { status: 401 })

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: lots, error } = await admin.rpc('kyc_images_a_effacer')
    if (error || !lots) throw new Error('lecture impossible')
    const chemins = lots.flatMap((l: { chemins: string[] }) => l.chemins)
    if (chemins.length > 0) {
      const { error: erreurSuppression } = await admin.storage.from('kyc_prives').remove(chemins)
      if (erreurSuppression) throw new Error('suppression impossible')
      await admin.rpc('kyc_marquer_effacees', { p_ids: lots.map((l: { id: string }) => l.id) })
    }
    return new Response(JSON.stringify({ ok: true, dossiers: lots.length, images: chemins.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    console.error('Échec de la purge KYC')
    return new Response(JSON.stringify({ erreur: 'Une erreur est survenue.' }), { status: 500 })
  }
})
