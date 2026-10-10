// Sauvegarde hebdomadaire chiffrée (F1, RGP13, RGP25).
//  - base de données : schéma + données, par « supabase db dump » (demande Docker Desktop ou Podman) ;
//  - photos : export du bucket PUBLIC photos_publiques seulement. Le bucket kyc_prives n'est JAMAIS sauvegardé (RGP25).
// Les deux fichiers sont chiffrés (AES-256-GCM) avec une phrase secrète que toi seul connais, puis rangés HORS du dépôt
// et hors de Supabase (disque externe, autre cloud…). Le script garde les 8 dernières sauvegardes.
//
// Usage :
//   set SAUVEGARDE_PHRASE=<phrase d'au moins 16 caractères>
//   set SAUVEGARDE_DOSSIER=D:\sauvegardes-colokniamey        (par défaut : ..\sauvegardes-colokniamey)
//   npm run sauvegarde
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { chiffrerFichier, LONGUEUR_PHRASE_MIN } from './lib/chiffrement.mjs'

const phrase = process.env.SAUVEGARDE_PHRASE ?? ''
if (phrase.length < LONGUEUR_PHRASE_MIN) {
  console.error(`Définis SAUVEGARDE_PHRASE (au moins ${LONGUEUR_PHRASE_MIN} caractères) avant de lancer la sauvegarde.`)
  process.exit(2)
}

const depot = resolve('.')
const dossier = resolve(process.env.SAUVEGARDE_DOSSIER ?? join(depot, '..', 'sauvegardes-colokniamey'))
// Une sauvegarde dans le dépôt finirait un jour sur GitHub : on refuse.
if (dossier === depot || dossier.startsWith(depot + sep)) {
  console.error('Le dossier de sauvegarde ne doit pas être dans le dépôt Git. Choisis un dossier extérieur avec SAUVEGARDE_DOSSIER.')
  process.exit(2)
}
mkdirSync(dossier, { recursive: true })

const date = new Date().toISOString().slice(0, 10)
const travail = mkdtempSync(join(tmpdir(), 'colokniamey-'))
const executer = (args) => execFileSync('npx', ['supabase', ...args], { stdio: 'inherit', shell: true })

try {
  // 1. Base de données : schéma, puis données
  const schema = join(travail, 'schema.sql')
  const donnees = join(travail, 'donnees.sql')
  executer(['db', 'dump', '--linked', '-f', schema])
  executer(['db', 'dump', '--linked', '--data-only', '--use-copy', '-f', donnees])
  const base = join(travail, 'base.sql')
  execFileSync(process.execPath, ['-e', `const fs=require('fs');fs.writeFileSync(${JSON.stringify(base)},fs.readFileSync(${JSON.stringify(schema)})+'\\n'+fs.readFileSync(${JSON.stringify(donnees)}))`])
  chiffrerFichier(base, join(dossier, `base-${date}.sql.chiffre`), phrase)
  console.log(`Base sauvegardée : base-${date}.sql.chiffre`)

  // 2. Photos publiques seulement (jamais kyc_prives)
  const photos = join(travail, 'photos')
  mkdirSync(photos)
  try {
    executer(['storage', 'cp', '-r', 'ss:///photos_publiques', photos, '--linked', '--experimental'])
    const archive = join(travail, 'photos.tar')
    execFileSync('tar', ['-cf', archive, '-C', photos, '.'], { stdio: 'inherit' })
    chiffrerFichier(archive, join(dossier, `photos-${date}.tar.chiffre`), phrase)
    console.log(`Photos sauvegardées : photos-${date}.tar.chiffre`)
  } catch {
    console.warn('Les photos n\'ont pas pu être exportées (bucket vide ou commande indisponible). La sauvegarde de la base reste valable.')
  }

  // 3. On garde les 8 dernières sauvegardes de chaque sorte
  for (const prefixe of ['base-', 'photos-']) {
    const anciennes = readdirSync(dossier)
      .filter((f) => f.startsWith(prefixe) && f.endsWith('.chiffre'))
      .map((f) => ({ f, t: statSync(join(dossier, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .slice(8)
    for (const { f } of anciennes) unlinkSync(join(dossier, f))
  }
  console.log(`\nSauvegarde terminée dans ${dossier}. Copie-la hors de cet ordinateur et teste régulièrement la restauration.`)
} finally {
  if (existsSync(travail)) rmSync(travail, { recursive: true, force: true })
}
