// Restauration d'une sauvegarde chiffrée (F1, RGP13).
// À tester sur un projet Supabase VIDE (jamais sur la production) :
//   set SAUVEGARDE_PHRASE=<phrase>
//   node scripts/restaurer.mjs <fichier base-AAAA-MM-JJ.sql.chiffre> [--appliquer <adresse de connexion du projet vide>]
// Sans --appliquer, le script déchiffre seulement le fichier en .sql à côté de la sauvegarde ; avec --appliquer, il envoie
// ce fichier au projet vide avec psql (outil PostgreSQL à installer). L'adresse de connexion vient du tableau de bord
// Supabase du projet vide : Project Settings → Database → Connection string.
import { execFileSync } from 'node:child_process'
import { unlinkSync } from 'node:fs'
import { dechiffrerFichier } from './lib/chiffrement.mjs'

const [fichier, option, adresse] = process.argv.slice(2)
const phrase = process.env.SAUVEGARDE_PHRASE ?? ''
if (!fichier || !fichier.endsWith('.chiffre')) {
  console.error('Usage : node scripts/restaurer.mjs <fichier.chiffre> [--appliquer <adresse du projet vide>]')
  process.exit(2)
}
const sortie = fichier.replace(/\.chiffre$/, '')
try {
  dechiffrerFichier(fichier, sortie, phrase)
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Déchiffrement impossible.')
  process.exit(1)
}
console.log(`Fichier déchiffré : ${sortie}`)

if (option === '--appliquer') {
  if (!adresse || !/^postgres(ql)?:\/\//.test(adresse)) {
    console.error('Donne l\'adresse de connexion du projet VIDE (postgresql://…).')
    process.exit(2)
  }
  try {
    execFileSync('psql', [adresse, '-v', 'ON_ERROR_STOP=1', '-f', sortie], { stdio: 'inherit' })
    console.log('Restauration appliquée. Vérifie ensuite : nombre de comptes, d\'annonces, et « npm run test:sql » sur le projet restauré.')
  } finally {
    // le fichier déchiffré contient des données personnelles : on ne le laisse pas traîner
    unlinkSync(sortie)
  }
} else {
  console.log('Supprime ce fichier déchiffré dès que tu as fini : il contient des données personnelles en clair.')
}
