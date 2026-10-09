// Module partagé de sécurité des Edge Functions (RGP22).
// Vérification du jeton et du rôle, CORS limité, validation des entrées,
// taille de requête limitée, erreurs génériques.

import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

const TAILLE_MAX_OCTETS = 20_000

export type Role = 'etudiant' | 'proprietaire' | 'admin' | 'super_admin'

/** Erreur dont le message peut être montré tel quel à l'appelant. */
export class ErreurHttp extends Error {
  constructor(
    public statut: number,
    message: string,
  ) {
    super(message)
  }
}

// RGP22 : CORS limité aux adresses de l'application (secret ORIGINES_AUTORISEES, séparées par des virgules)
function originesAutorisees(): string[] {
  const configurees = Deno.env.get('ORIGINES_AUTORISEES') ?? ''
  const liste = configurees
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
  return liste.length > 0 ? liste : ['http://localhost:5173']
}

function entetesCors(origine: string | null): Record<string, string> {
  const autorisee = origine !== null && originesAutorisees().includes(origine)
  return {
    'Access-Control-Allow-Origin': autorisee ? origine : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function reponseJson(corps: unknown, statut: number, origine: string | null): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...entetesCors(origine), 'Content-Type': 'application/json' },
  })
}

export interface Contexte {
  req: Request
  user: User
  role: Role
  /** Client agissant avec les droits de l'appelant (RLS appliquée). */
  client: SupabaseClient
  /** Client service_role : à utiliser avec précaution, seulement dans une Edge Function. */
  admin: SupabaseClient
  corps: Record<string, unknown>
}

/**
 * Enrobe le traitement d'une Edge Function.
 * - OPTIONS et origines non autorisées gérées ici ;
 * - jeton obligatoire, rôle contrôlé ;
 * - corps JSON de taille limitée ;
 * - toute erreur inattendue devient un message générique.
 */
export function servir(
  rolesAutorises: Role[],
  traitement: (ctx: Contexte) => Promise<unknown>,
): void {
  Deno.serve(async (req) => {
    const origine = req.headers.get('Origin')

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: entetesCors(origine) })
    }

    try {
      if (origine !== null && !originesAutorisees().includes(origine)) {
        throw new ErreurHttp(403, 'Origine non autorisée.')
      }
      if (req.method !== 'POST') {
        throw new ErreurHttp(405, 'Méthode non autorisée.')
      }

      // Jeton obligatoire
      const autorisation = req.headers.get('Authorization')
      if (!autorisation?.startsWith('Bearer ')) {
        throw new ErreurHttp(401, 'Connexion requise.')
      }

      const url = Deno.env.get('SUPABASE_URL')!
      const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: autorisation } },
        auth: { persistSession: false },
      })
      const { data, error } = await client.auth.getUser()
      if (error || !data.user) {
        throw new ErreurHttp(401, 'Connexion requise.')
      }

      // Rôle lu en base avec la clé service_role : jamais fourni par l'appelant
      const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false },
      })
      const { data: profil } = await admin
        .from('profils')
        .select('role, statut')
        .eq('id', data.user.id)
        .maybeSingle()
      const role = profil?.role as Role | undefined
      // RG08 : un compte suspendu ou désactivé n'agit plus, même avec un jeton encore valide
      if (profil?.statut !== 'actif' || !role || !rolesAutorises.includes(role)) {
        throw new ErreurHttp(403, 'Action non autorisée.')
      }

      // Taille limitée, corps JSON objet
      const texte = await req.text()
      if (new TextEncoder().encode(texte).length > TAILLE_MAX_OCTETS) {
        throw new ErreurHttp(413, 'Requête trop volumineuse.')
      }
      let corps: Record<string, unknown> = {}
      if (texte.length > 0) {
        const analyse: unknown = JSON.parse(texte)
        if (typeof analyse !== 'object' || analyse === null || Array.isArray(analyse)) {
          throw new ErreurHttp(400, 'Requête invalide.')
        }
        corps = analyse as Record<string, unknown>
      }

      const resultat = await traitement({ req, user: data.user, role, client, admin, corps })
      return reponseJson(resultat ?? { ok: true }, 200, origine)
    } catch (e) {
      if (e instanceof ErreurHttp) {
        return reponseJson({ erreur: e.message }, e.statut, origine)
      }
      // Erreur générique : aucun détail technique renvoyé (RGP22)
      console.error('Erreur inattendue dans une Edge Function')
      return reponseJson({ erreur: 'Une erreur est survenue.' }, 500, origine)
    }
  })
}

// --- Validation des entrées ---

export function texteBorne(valeur: unknown, nom: string, min: number, max: number): string {
  if (typeof valeur !== 'string') throw new ErreurHttp(400, `Champ invalide : ${nom}.`)
  const nettoye = valeur.trim()
  if (nettoye.length < min || nettoye.length > max) {
    throw new ErreurHttp(400, `Champ invalide : ${nom}.`)
  }
  return nettoye
}

export function uuid(valeur: unknown, nom: string): string {
  if (
    typeof valeur !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur)
  ) {
    throw new ErreurHttp(400, `Champ invalide : ${nom}.`)
  }
  return valeur
}
