// Tests d'attaque contre un projet Supabase en ligne (F1, RGP17 à RGP27), avec la SEULE clé publique.
// Usage (la clé publique « anon » n'est pas un secret, mais ne la mets pas dans le dépôt) :
//   set SUPABASE_URL=https://<projet>.supabase.co
//   set SUPABASE_ANON_KEY=<clé publique>
//   node scripts/attaques.mjs [--markdown]
// Ce script n'utilise JAMAIS la clé service_role. Il ne crée aucune donnée : toutes les requêtes doivent être refusées ou
// ne renvoyer que des données publiques. Il sort avec le code 1 si une attaque réussit.
import { readdirSync } from 'node:fs'

const URL_BASE = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const CLE = process.env.SUPABASE_ANON_KEY ?? ''
if (!URL_BASE || !CLE) {
  console.error('Définis SUPABASE_URL et SUPABASE_ANON_KEY (clé publique) avant de lancer ce script.')
  process.exit(2)
}

const en = (extra = {}) => ({ apikey: CLE, 'Content-Type': 'application/json', ...extra })
const resultats = []

function noter(regle, test, attendu, obtenu, reussi) {
  resultats.push({ regle, test, attendu, obtenu, reussi })
}

async function appeler(chemin, options = {}) {
  const reponse = await fetch(`${URL_BASE}${chemin}`, options)
  const texte = await reponse.text()
  return { statut: reponse.status, texte }
}

// --- 1. Edge Functions : sans jeton, avec la clé publique seule, depuis une origine non autorisée ---
const fonctions = readdirSync('supabase/functions', { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== '_shared')
  .map((d) => d.name)
// Fonctions appelées par pg_cron avec un secret partagé (jamais par un utilisateur)
const planifiees = ['admin-recapitulatif', 'kyc-purge']

for (const nom of fonctions) {
  const chemin = `/functions/v1/${nom}`
  const sansJeton = await appeler(chemin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  noter('RGP22', `${nom} : appel sans jeton`, '401 ou 403 (404 : non déployée)', String(sansJeton.statut), [401, 403, 404].includes(sansJeton.statut))

  if (planifiees.includes(nom)) {
    const mauvais = await appeler(chemin, { method: 'POST', headers: en({ Authorization: `Bearer ${CLE}`, 'x-cron-secret': 'mauvais-secret-0123456789' }), body: '{}' })
    noter('RGP22', `${nom} : mauvais secret partagé`, '401', String(mauvais.statut), mauvais.statut === 401)
    continue
  }
  const cleSeule = await appeler(chemin, { method: 'POST', headers: en({ Authorization: `Bearer ${CLE}`, Origin: 'http://localhost:5173' }), body: '{}' })
  noter('RGP22', `${nom} : clé publique comme jeton (pas un utilisateur)`, '401 ou 403 (404 : non déployée)', String(cleSeule.statut), [401, 403, 404].includes(cleSeule.statut))
  const origine = await appeler(chemin, { method: 'POST', headers: en({ Authorization: `Bearer ${CLE}`, Origin: 'https://site-pirate.example' }), body: '{}' })
  noter('RGP22', `${nom} : origine non autorisée`, '401 ou 403 (404 : non déployée)', String(origine.statut), [401, 403, 404].includes(origine.statut))
  const methode = await appeler(chemin, { method: 'GET', headers: en({ Authorization: `Bearer ${CLE}` }) })
  noter('RGP22', `${nom} : méthode GET`, 'refusée (4xx)', String(methode.statut), methode.statut >= 400 && methode.statut < 500)
}

// --- 2. API REST : lecture de chaque table avec la seule clé publique ---
const PUBLIQUES = new Set(['annonce_equipements', 'annonces', 'equipements', 'quartiers', 'regles_annonce', 'taches_annonce', 'universites', 'villes', 'annonces_publiques', 'quartiers_geo', 'universites_geo', 'villes_geo'])
const ouverture = await appeler('/rest/v1/', { headers: en({ Authorization: `Bearer ${CLE}` }) })
let tables = []
try {
  tables = Object.keys(JSON.parse(ouverture.texte).paths ?? {}).filter((p) => p !== '/' && !p.startsWith('/rpc/')).map((p) => p.slice(1))
} catch {
  // la description de l'API n'est pas accessible : on s'appuie sur la liste connue
}
if (tables.length === 0) tables = [...PUBLIQUES]
for (const table of tables) {
  const r = await appeler(`/rest/v1/${table}?select=*&limit=1`, { headers: en({ Authorization: `Bearer ${CLE}` }) })
  let donnees = null
  try {
    donnees = JSON.parse(r.texte)
  } catch {
    // corps non JSON
  }
  const ligne = Array.isArray(donnees) && donnees.length > 0
  if (PUBLIQUES.has(table)) {
    // une table publique : « select * » est refusé pour annonces (colonne position), sinon la RLS filtre
    noter('RGP04', `lecture publique de ${table}`, 'données publiques seulement', `${r.statut}${ligne ? ' (lignes publiques)' : ''}`, !(table.startsWith('annonces') && r.texte.includes('"position"')))
  } else {
    noter('RGP04', `lecture de ${table} avec la clé publique`, 'refusée ou vide', `${r.statut}${ligne ? ' (LIGNES RENVOYÉES)' : ''}`, !ligne)
  }
}
const position = await appeler('/rest/v1/annonces?select=position&limit=1', { headers: en({ Authorization: `Bearer ${CLE}` }) })
noter('RG23', 'lecture de la colonne position (point exact)', 'refusée', String(position.statut), position.statut >= 400 && !position.texte.includes('POINT'))
const ecriture = await appeler('/rest/v1/annonces', { method: 'POST', headers: en({ Authorization: `Bearer ${CLE}`, Prefer: 'return=minimal' }), body: JSON.stringify({ titre: 'Pirate' }) })
noter('RGP04', 'écriture dans annonces par un visiteur', 'refusée (4xx)', String(ecriture.statut), ecriture.statut >= 400 && ecriture.statut < 500)
const effacement = await appeler('/rest/v1/profils?id=not.is.null', { method: 'DELETE', headers: en({ Authorization: `Bearer ${CLE}`, Prefer: 'return=minimal' }) })
noter('RGP04', 'suppression de profils par un visiteur', 'refusée (4xx)', String(effacement.statut), effacement.statut >= 400 && effacement.statut < 500)

// --- 3. RPC : fonctions internes et fonctions réservées aux connectés, appelées par un visiteur ---
const internes = [
  'journaliser', 'notifier', 'verifier_texte', 'normaliser_texte', 'consommer_quota', 'alertes_files', 'taches_planifiees', 'anonymiser_compte',
  'admin_action_suspendre', 'kyc_enregistrer_image', 'kyc_images_a_effacer', 'kyc_preparer_depot', 'cloturer_groupes_inactifs',
  'exporter_donnees_profils', 'declencher_recapitulatif', 'identite_conforme', 'exiger_identite_verifiee', 'mettre_a_jour_groupe', 'verifier_seuils', 'agreger_visites', 'agreger_mesures', 'purger_erreurs',
]
const connectes = [
  'valider_annonce', 'decider_kyc', 'decider_photo', 'definir_maintenance', 'modifier_parametre', 'valider_terme', 'liste_utilisateurs',
  'liste_signalements', 'demarrer_conversation', 'creer_groupe', 'soumettre_annonce', 'contact_annonce', 'exporter_mes_donnees', 'signaler',
  'mon_kyc', 'liste_conversations', 'mes_favoris', 'position_annonce', 'supervision', 'stats_visites', 'liste_journal', 'definir_seuil', 'changer_statut_erreur',
]
for (const nom of [...internes, ...connectes]) {
  const r = await appeler(`/rest/v1/rpc/${nom}`, { method: 'POST', headers: en({ Authorization: `Bearer ${CLE}` }), body: '{}' })
  noter('RGP17', `appel de ${nom}() par un visiteur`, '401, 403 ou 404', String(r.statut), [401, 403, 404].includes(r.statut))
}

// --- 4. Inscription sans jeton anti-robots (Turnstile) ---
const inscription = await appeler('/auth/v1/signup', {
  method: 'POST',
  headers: en(),
  body: JSON.stringify({ email: 'attaque-sans-captcha@example.invalid', password: 'MotDePasse-Test-12345' }),
})
noter('RGP19', 'inscription sans jeton Turnstile', '400 « captcha »', `${inscription.statut} ${/captcha/i.test(inscription.texte) ? '(captcha exigé)' : ''}`, inscription.statut === 400 && /captcha/i.test(inscription.texte))
const connexion = await appeler('/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: en(),
  body: JSON.stringify({ email: 'attaque-sans-captcha@example.invalid', password: 'MotDePasse-Test-12345' }),
})
noter('RGP19', 'connexion sans jeton Turnstile', '400 « captcha »', `${connexion.statut} ${/captcha/i.test(connexion.texte) ? '(captcha exigé)' : ''}`, connexion.statut === 400 && /captcha/i.test(connexion.texte))

// --- 5. Storage : lecture publique des buckets privés ---
for (const bucket of ['kyc_prives', 'photos_en_attente']) {
  const r = await appeler(`/storage/v1/object/public/${bucket}/test.webp`, { headers: en() })
  noter('RGP21', `lecture publique du bucket ${bucket}`, '400 ou 404 (bucket privé)', String(r.statut), [400, 401, 403, 404].includes(r.statut))
  const liste = await appeler(`/storage/v1/object/list/${bucket}`, { method: 'POST', headers: en({ Authorization: `Bearer ${CLE}` }), body: JSON.stringify({ prefix: '', limit: 5 }) })
  let vide = true
  try {
    const d = JSON.parse(liste.texte)
    vide = !Array.isArray(d) || d.length === 0
  } catch {
    // corps non JSON
  }
  noter('RGP21', `liste du bucket ${bucket} par un visiteur`, 'vide ou refusée', String(liste.statut), vide)
}
const envoi = await appeler('/storage/v1/object/photos_publiques/pirate.webp', { method: 'POST', headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, 'Content-Type': 'image/webp' }, body: 'x' })
noter('RGP21', 'envoi direct dans photos_publiques par un visiteur', 'refusé (4xx)', String(envoi.statut), envoi.statut >= 400 && envoi.statut < 500)

// --- Résultats ---
const echecs = resultats.filter((r) => !r.reussi)
if (process.argv.includes('--markdown')) {
  console.log('| Règle | Test | Résultat attendu | Résultat obtenu | Verdict |\n|---|---|---|---|---|')
  for (const r of resultats) console.log(`| ${r.regle} | ${r.test} | ${r.attendu} | ${r.obtenu} | ${r.reussi ? 'réussi' : '**ÉCHEC**'} |`)
} else {
  for (const r of resultats) console.log(`${r.reussi ? 'OK    ' : 'ÉCHEC '} [${r.regle}] ${r.test} → ${r.obtenu}`)
}
console.log(`\n${resultats.length - echecs.length} test(s) réussi(s) sur ${resultats.length}.`)
process.exit(echecs.length === 0 ? 0 : 1)
