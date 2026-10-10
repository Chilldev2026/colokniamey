// Rejoue tous les scripts SQL de supabase/tests sur le projet Supabase lié (F1) : RLS de chaque module, quotas, audit de sécurité.
// Chaque script s'exécute dans une transaction annulée à la fin : aucune donnée ne reste. Un script échoue s'il lève une
// exception « ÉCHEC ». Usage : npm run test:sql   (le projet doit être lié : npx supabase link)
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dossier = 'supabase/tests'
const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.test.sql')).sort()
let echecs = 0

for (const f of fichiers) {
  const debut = Date.now()
  let sortie = ''
  let ok = true
  try {
    sortie = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', join(dossier, f)], { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    ok = false
    sortie = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  if (sortie.includes('"_tag":"Error"') || sortie.includes('ÉCHEC')) ok = false
  const duree = ((Date.now() - debut) / 1000).toFixed(1)
  console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${f} (${duree} s)`)
  if (!ok) {
    echecs++
    const message = sortie.match(/ÉCHEC[^\\"\n]*/)?.[0] ?? sortie.slice(0, 300)
    console.log(`        ${message}`)
  }
}

console.log(`\n${fichiers.length - echecs} script(s) réussi(s) sur ${fichiers.length}.`)
process.exit(echecs === 0 ? 0 : 1)
