// Client Supabase unique de l'application (jamais de service_role ici, RGP05).
// Un enrobage de fetch mesure la durée et le résultat de chaque appel (RGA21 à RGA25).

import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from './types/database'
import { decrireRequete } from './observabilite/decrireRequete'
import { lireModuleCourant } from './observabilite/contexte'
import { configurerMesures, enregistrerMesure, type Mesure } from './observabilite/mesures'

const url = import.meta.env.VITE_SUPABASE_URL
const cleAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !cleAnon) {
  throw new Error(
    'Configuration manquante : renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env (voir .env.example).',
  )
}

/** fetch qui mesure chaque appel puis délègue au fetch du navigateur. */
async function fetchMesure(entree: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const adresse = entree instanceof Request ? entree.url : entree.toString()
  const methode = options?.method ?? (entree instanceof Request ? entree.method : 'GET')
  const operation = decrireRequete(adresse, methode)
  const debut = performance.now()
  try {
    const reponse = await fetch(entree, options)
    if (operation) {
      enregistrerMesure({
        module: lireModuleCourant(),
        operation,
        duree_ms: performance.now() - debut,
        succes: reponse.ok,
      })
    }
    return reponse
  } catch (erreur) {
    if (operation) {
      enregistrerMesure({
        module: lireModuleCourant(),
        operation,
        duree_ms: performance.now() - debut,
        succes: false,
      })
    }
    throw erreur
  }
}

export const supabase = createClient<Database>(url, cleAnon, {
  global: { fetch: fetchMesure },
})

// RGA25 : les lots de mesures partent par la RPC enregistrer_mesures
configurerMesures(async (lot: Mesure[], session: string) => {
  await supabase.rpc('enregistrer_mesures', { p_lot: lot as unknown as Json, p_session: session })
})
