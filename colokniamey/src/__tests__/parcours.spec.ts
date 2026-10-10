// F1 : parcours complet avec un client Supabase simulé (en mémoire).
// inscription → publication avec localisation → validation admin → recherche sur la carte → contact → groupe de colocation
// lancé puis complété par un second étudiant → texte bloquant refusé et photo validée par l'admin → signalement traité
// → suspension d'un compte.
// Ce test vérifie l'enchaînement des services de l'application. Les règles elles-mêmes (RLS, déclencheurs, quotas) sont
// vérifiées par les scripts SQL de supabase/tests, rejoués par « npm run test:sql ».
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Ligne = Record<string, unknown>
interface Erreur {
  code: string
  message: string
}

// --- Base de données simulée ---
const base = vi.hoisted(() => {
  return {
    tables: {} as Record<string, Ligne[]>,
    utilisateur: null as { id: string } | null,
    compteurs: {} as Record<string, number>,
    appels: [] as string[],
  }
})

vi.mock('@/core/supabase', () => {
  const CENTRE = { lat: 13.51361, lng: 2.10972, rayonKm: 20 }
  const erreur = (message: string): { data: null; error: Erreur } => ({ data: null, error: { code: 'P0001', message } })
  const profil = (id: string | undefined) => base.tables.profils?.find((p) => p.id === id)
  const role = () => String(profil(base.utilisateur?.id)?.role ?? '')
  const estAdmin = () => role() === 'admin' || role() === 'super_admin'
  const prochainId = (t: string): number => {
    base.compteurs[t] = (base.compteurs[t] ?? 0) + 1
    return base.compteurs[t]!
  }
  const distanceKm = (lat: number, lng: number): number => {
    const r = 6371
    const rad = (d: number) => (d * Math.PI) / 180
    const a = Math.sin(rad(lat - CENTRE.lat) / 2) ** 2 + Math.cos(rad(CENTRE.lat)) * Math.cos(rad(lat)) * Math.sin(rad(lng - CENTRE.lng) / 2) ** 2
    return 2 * r * Math.asin(Math.sqrt(a))
  }
  const publiee = (a: Ligne) => a.statut === 'publiee' && base.tables.profils?.find((p) => p.id === a.auteur_id)?.statut === 'actif'

  class Requete implements PromiseLike<{ data: unknown; error: Erreur | null }> {
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    private filtres: ((l: Ligne) => boolean)[] = []
    private valeurs: Ligne | Ligne[] = {}
    private unique: 'single' | 'maybe' | null = null
    constructor(private table: string) {}
    select() {
      return this
    }
    insert(v: Ligne | Ligne[]) {
      this.op = 'insert'
      this.valeurs = v
      return this
    }
    update(v: Ligne) {
      this.op = 'update'
      this.valeurs = v
      return this
    }
    delete() {
      this.op = 'delete'
      return this
    }
    eq(col: string, val: unknown) {
      this.filtres.push((l) => l[col] === val)
      return this
    }
    in(col: string, vals: unknown[]) {
      this.filtres.push((l) => vals.includes(l[col]))
      return this
    }
    order() {
      return this
    }
    limit() {
      return this
    }
    single() {
      this.unique = 'single'
      return this
    }
    maybeSingle() {
      this.unique = 'maybe'
      return this
    }
    // Le client Supabase est « attendable » (await supabase.from(...)...) : la classe simulée doit l'être aussi
    // oxlint-disable-next-line unicorn/no-thenable
    then<T, U>(ok?: (v: { data: unknown; error: Erreur | null }) => T | PromiseLike<T>, ko?: (e: unknown) => U | PromiseLike<U>) {
      return Promise.resolve(this.executer()).then(ok, ko)
    }
    private executer(): { data: unknown; error: Erreur | null } {
      const lignes = (base.tables[this.table] ??= [])
      const cible = lignes.filter((l) => this.filtres.every((f) => f(l)))
      let resultat: Ligne[] = cible
      if (this.op === 'insert') {
        const liste = Array.isArray(this.valeurs) ? this.valeurs : [this.valeurs]
        resultat = []
        for (const v of liste) {
          const ligne: Ligne = { ...v, id: v.id ?? prochainId(this.table) }
          if (this.table === 'annonces') {
            // déclencheur de contrôle des textes (S) : dernière protection, même si l'interface a été contournée
            if (/interdit/i.test(String(ligne.titre) + String(ligne.description))) return { data: null, error: { code: 'P0001', message: 'Ce texte ne respecte pas les règles de ColokNiamey. Modifie-le et réessaie.' } }
            if (role() === 'etudiant' && ligne.type !== 'place_colocation') return { data: null, error: { code: 'P0001', message: 'Un étudiant publie une place en colocation, pas un logement entier.' } }
            ligne.statut = 'brouillon'
            ligne.position = null
          }
          if (this.table === 'photos_annonces') {
            const nb = lignes.filter((l) => l.annonce_id === ligne.annonce_id).length
            if (nb >= 5) return { data: null, error: { code: 'P0001', message: 'Une annonce accepte 5 photos au maximum.' } }
          }
          lignes.push(ligne)
          resultat.push(ligne)
        }
      } else if (this.op === 'update') {
        for (const l of cible) {
          const v = this.valeurs as Ligne
          if (this.table === 'annonces' && typeof v.position === 'string') {
            const m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(v.position)
            if (m && distanceKm(Number(m[2]), Number(m[1])) > CENTRE.rayonKm) return { data: null, error: { code: 'P0001', message: 'Cette position est en dehors de la zone de la ville.' } }
          }
          Object.assign(l, v)
        }
      } else if (this.op === 'delete') {
        base.tables[this.table] = lignes.filter((l) => !cible.includes(l))
      }
      if (this.unique === 'single') return resultat.length === 1 ? { data: resultat[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'Aucune ligne' } }
      if (this.unique === 'maybe') return { data: resultat[0] ?? null, error: null }
      return { data: resultat, error: null }
    }
  }

  // --- Fonctions SQL simulées (le strict nécessaire au parcours) ---
  const rpc = (nom: string, a: Record<string, unknown> = {}): Promise<{ data: unknown; error: Erreur | null }> => {
    base.appels.push(nom)
    const annonces = (base.tables.annonces ??= [])
    const moi = base.utilisateur?.id
    const annonce = (id: unknown) => annonces.find((x) => x.id === id)
    const rep = (data: unknown) => Promise.resolve({ data, error: null })
    const ko = (message: string) => Promise.resolve(erreur(message))

    switch (nom) {
      case 'controler_texte':
        return rep(/interdit/i.test(String(a.p_texte)) ? 'bloque' : 'accepte')
      case 'soumettre_annonce': {
        const x = annonce(a.p_annonce_id)
        if (!x || x.auteur_id !== moi) return ko('Annonce introuvable.')
        if (!x.position) return ko('Place ton logement sur la carte avant de soumettre l\'annonce.')
        x.statut = 'en_attente'
        return rep('en_attente')
      }
      case 'valider_annonce': {
        if (!estAdmin()) return ko('Action non autorisée.')
        const x = annonce(a.p_id)
        if (!x || x.statut !== 'en_attente') return ko('Annonce introuvable ou déjà traitée.')
        x.statut = 'publiee'
        return rep(null)
      }
      case 'rechercher_annonces':
      case 'annonces_carte': {
        const f = (a.p_filtres ?? {}) as Record<string, unknown>
        const lignes = annonces.filter(publiee).filter((x) => (!f.type || x.type === f.type) && (!f.loyer_max || Number(x.part_mensuelle_fcfa) <= Number(f.loyer_max)))
        return rep(
          lignes.map((x) => {
            const [lng, lat] = String(/POINT\((.+)\)/.exec(String(x.position))?.[1]).split(' ').map(Number) as [number, number]
            // RG23 : position publique ramenée sur une grille de 0,0015°, jamais le point exact
            const grille = (v: number) => Math.round(v / 0.0015) * 0.0015
            return {
              id: x.id, type: x.type, titre: x.titre, part_mensuelle_fcfa: x.part_mensuelle_fcfa, loyer_total_fcfa: null, nb_places: x.nb_places, quartier_id: x.quartier_id,
              universite_proche_id: null, disponible_le: null, photo_chemin: null, latitude: grille(lat), longitude: grille(lng), zone_rayon_m: 150,
              distance_universite_m: null, distance_ref_m: null, publiee_le: '2026-10-01', curseur_valeur: '1', groupe_en_formation: false,
            }
          }),
        )
      }
      case 'contact_annonce': {
        if (!moi) return ko('Connecte-toi pour contacter l\'annonceur.')
        const x = annonce(a.p_annonce_id)
        return rep([{ telephone: x?.contact_appel ? '+22790112233' : null, whatsapp: x?.contact_whatsapp ? '22790112233' : null }])
      }
      case 'demarrer_conversation': {
        const x = annonce(a.p_annonce_id)
        if (!x || x.statut !== 'publiee') return ko('Cette annonce n\'est plus disponible.')
        if (x.auteur_id === moi) return ko('Tu ne peux pas t\'écrire à toi-même.')
        const conv = (base.tables.conversations ??= [])
        const id = conv.length + 1
        conv.push({ id, annonce_id: x.id, demandeur_id: moi, auteur_id: x.auteur_id })
        ;(base.tables.messages ??= []).push({ conversation_id: id, expediteur_id: moi, contenu: a.p_message })
        return rep(id)
      }
      case 'creer_groupe': {
        if (role() !== 'etudiant') return ko('Seuls les étudiants peuvent former ou rejoindre un groupe.')
        const x = annonce(a.p_annonce_id)
        if (!x || x.statut !== 'publiee') return ko('Ce logement n\'est plus disponible.')
        if (Number(a.p_places) > Number(x.nb_places) - 1) return ko('Trop de colocataires recherchés pour ce logement.')
        const groupes = (base.tables.groupes ??= [])
        const id = groupes.length + 1
        groupes.push({ id, annonce_id: x.id, initiateur_id: moi, places: Number(a.p_places), statut: 'en_formation' })
        ;(base.tables.membres ??= []).push({ id: 1000 + id, groupe_id: id, user_id: moi, role: 'initiateur', statut: 'accepte' })
        return rep(id)
      }
      case 'groupes_du_logement': {
        const g = (base.tables.groupes ?? []).filter((x) => x.annonce_id === a.p_annonce_id && x.statut === 'en_formation')
        return rep(
          g.map((x) => {
            const membres = (base.tables.membres ?? []).filter((m) => m.groupe_id === x.id && m.statut === 'accepte').length
            return {
              id: x.id, initiateur_id: x.initiateur_id, initiateur_prenom: 'Aïcha', initiateur_initiale: 'M', places_recherchees: x.places, membres,
              places_restantes: Number(x.places) + 1 - membres, part_estimee_fcfa: 30000, message: null, preferences: null, statut: x.statut,
              mon_statut: (base.tables.membres ?? []).find((m) => m.groupe_id === x.id && m.user_id === moi)?.statut ?? null,
            }
          }),
        )
      }
      case 'demander_adhesion': {
        if (role() !== 'etudiant') return ko('Seuls les étudiants peuvent former ou rejoindre un groupe.')
        const g = (base.tables.groupes ?? []).find((x) => x.id === a.p_groupe_id)
        if (!g || g.statut !== 'en_formation') return ko('Ce groupe est complet.')
        ;(base.tables.membres ??= []).push({ id: 2000 + (base.tables.membres?.length ?? 0), groupe_id: g.id, user_id: moi, role: 'membre', statut: 'en_attente' })
        return rep(null)
      }
      case 'repondre_demande': {
        const m = (base.tables.membres ?? []).find((x) => x.id === a.p_membre_id)
        const g = (base.tables.groupes ?? []).find((x) => x.id === m?.groupe_id)
        if (!m || !g || g.initiateur_id !== moi) return ko('Seul l\'initiateur du groupe peut répondre aux demandes.')
        m.statut = a.p_accepter ? 'accepte' : 'refuse'
        const acceptes = (base.tables.membres ?? []).filter((x) => x.groupe_id === g.id && x.statut === 'accepte').length
        if (acceptes >= Number(g.places) + 1) g.statut = 'complet'
        return rep(null)
      }
      case 'signaler': {
        const x = annonce(Number(a.p_cible_id))
        if (a.p_cible_type === 'annonce' && x?.auteur_id === moi) return ko('Tu ne peux pas te signaler toi-même.')
        const s = (base.tables.signalements ??= [])
        if (s.some((y) => y.auteur_id === moi && y.cible_id === a.p_cible_id && ['nouveau', 'en_cours'].includes(String(y.statut)))) return ko('Tu as déjà signalé ce contenu : l\'équipe va le traiter.')
        s.push({ id: s.length + 1, auteur_id: moi, cible_type: a.p_cible_type, cible_id: a.p_cible_id, cible_auteur_id: x?.auteur_id ?? null, statut: 'nouveau' })
        return rep(s.length)
      }
      case 'prendre_en_charge_signalement': {
        if (!estAdmin()) return ko('Action non autorisée.')
        const s = (base.tables.signalements ?? []).find((y) => y.id === a.p_id)
        if (!s || s.statut !== 'nouveau') return ko('Ce signalement est déjà pris en charge ou n\'existe plus.')
        s.statut = 'en_cours'
        s.traite_par = moi
        return rep(null)
      }
      case 'cloturer_signalement': {
        const s = (base.tables.signalements ?? []).find((y) => y.id === a.p_id)
        if (!s || s.traite_par !== moi) return ko('Seul l\'administrateur qui a pris ce signalement en charge peut le clore.')
        if (a.p_decision === 'suspendre_auteur') {
          if (!a.p_commentaire) return ko('Un motif de 3 à 300 caractères est obligatoire pour cette décision.')
          const p = profil(String(s.cible_auteur_id))
          if (p) p.statut = 'suspendu'
        }
        s.statut = a.p_decision === 'rejeter' ? 'rejete' : 'traite'
        return rep(null)
      }
      default:
        return ko(`Fonction simulée inconnue : ${nom}`)
    }
  }

  const supabase = {
    from: (table: string) => new Requete(table),
    rpc,
    auth: {
      signUp: (p: { email: string; options: { data: Record<string, string> } }) => {
        const d = p.options.data
        if (!d.cgu_version) return Promise.resolve({ error: { code: 'unexpected_failure', message: 'Database error saving new user', status: 500 } })
        const id = `u${(base.tables.profils ??= []).length + 1}`
        base.tables.profils.push({ id, email: p.email, role: d.role, prenom: d.prenom, nom: d.nom, statut: 'actif' })
        return Promise.resolve({ error: null })
      },
      signInWithPassword: (p: { email: string }) => {
        const u = base.tables.profils?.find((x) => x.email === p.email)
        if (u?.statut === 'suspendu') return Promise.resolve({ error: { code: 'user_banned', message: 'User is banned', status: 400 } })
        base.utilisateur = u ? { id: String(u.id) } : null
        return Promise.resolve({ error: u ? null : { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 } })
      },
      getUser: () => Promise.resolve({ data: { user: base.utilisateur } }),
    },
    functions: {
      invoke: (nom: string, o: { body: { photo_id: number; decision: string } }) => {
        if (nom === 'securite-photos-decision') {
          if (!estAdmin()) return Promise.resolve({ data: null, error: new Error('refusé') })
          const p = base.tables.photos?.find((x) => x.id === o.body.photo_id)
          if (p) p.statut = o.body.decision === 'valider' ? 'validee' : 'refusee'
        }
        return Promise.resolve({ data: { ok: true }, error: null })
      },
    },
    storage: { from: () => ({ getPublicUrl: (c: string) => ({ data: { publicUrl: `https://x/${c}` } }) }) },
  }
  return { supabase }
})

import { inscrire, connecter } from '@/modules/auth/services/authService'
import { ajouterPhoto, creerAnnonce, lireContactAnnonce, modifierAnnonce, soumettreAnnonce } from '@/modules/annonces/services/annoncesService'
import { formulaireVide } from '@/modules/annonces/types'
import { validerAnnonce } from '@/modules/admin/moderation/services/moderationService'
import { annoncesCarte, rechercherAnnonces } from '@/modules/recherche/services/rechercheService'
import { filtresVides } from '@/modules/recherche/types'
import { demarrerConversation } from '@/modules/messagerie/services/messagerieService'
import { creerGroupe, demanderAdhesion, groupesDuLogement, repondreDemande } from '@/modules/groupes/services/groupesService'
import { deciderPhoto } from '@/modules/securite'
import { signaler } from '@/modules/signalements/services/signalementsService'
import { cloturer, prendreEnCharge } from '@/modules/admin/signalements/services/signalementsAdminService'
import type { DonneesInscription } from '@/modules/auth/validation'

function donnees(role: 'etudiant' | 'proprietaire', email: string, prenom: string): DonneesInscription {
  return { role, email, motDePasse: 'MotDePasse-12345', nom: 'Test', prenom, telephone: '90112233', universiteId: '1', typeProprietaire: 'particulier', conditionsAcceptees: true }
}
function connecterComme(email: string): Promise<void> {
  return connecter(email, 'MotDePasse-12345', 'jeton')
}
const ENTREE = { latitude: 13.51234, longitude: 2.12345 }

describe('parcours complet de la phase 1 (client Supabase simulé)', () => {
  beforeEach(() => {
    base.tables = { profils: [{ id: 'admin1', email: 'admin@test.local', role: 'admin', prenom: 'Admin', nom: 'Test', statut: 'actif' }] }
    base.utilisateur = null
    base.compteurs = {}
    base.appels = []
  })

  it('va de l\'inscription à la suspension d\'un compte', async () => {
    // 1. Inscription d'un propriétaire et de deux étudiants (RG03 : le formulaire ne crée que ces deux rôles)
    await inscrire(donnees('proprietaire', 'proprio@test.local', 'Moussa'), 'jeton', '1.0')
    await inscrire(donnees('etudiant', 'aicha@test.local', 'Aicha'), 'jeton', '1.0')
    await inscrire(donnees('etudiant', 'awa@test.local', 'Awa'), 'jeton', '1.0')
    expect(base.tables.profils!.map((p) => p.role)).toEqual(['admin', 'proprietaire', 'etudiant', 'etudiant'])
    // sans acceptation des conditions, la base refuse (RGP12)
    await expect(inscrire({ ...donnees('etudiant', 'x@test.local', 'X'), conditionsAcceptees: false }, 'jeton', '1.0')).rejects.toThrow('Inscription impossible')

    // 2. Le propriétaire publie un logement avec localisation (RG21, RG22)
    await connecterComme('proprio@test.local')
    const proprio = String(base.utilisateur!.id)
    const formulaire = { ...formulaireVide('appartement'), titre: 'Appartement près du campus', description: 'Un grand appartement de trois chambres près du campus.', partMensuelle: '90000', nbPlaces: '3', quartierId: '5' }
    const annonceId = await creerAnnonce(proprio, formulaire)
    await expect(soumettreAnnonce(annonceId)).rejects.toThrow('Place ton logement sur la carte') // pas de soumission sans position
    await expect(modifierAnnonce(annonceId, { ...formulaire, position: { latitude: 0, longitude: 0 } }, true, [])).rejects.toThrow('en dehors de la zone')
    await modifierAnnonce(annonceId, { ...formulaire, position: ENTREE }, true, [])
    // un texte interdit est refusé, avant l'envoi puis par le déclencheur
    await expect(creerAnnonce(proprio, { ...formulaire, titre: 'Annonce interdit' })).rejects.toThrow('ne respecte pas les règles')
    // photo : rattachée à l'annonce, puis validée par l'admin (RG49)
    base.tables.photos = [{ id: 7, statut: 'en_attente' }]
    await ajouterPhoto(annonceId, 7)
    expect(await soumettreAnnonce(annonceId)).toBe('en_attente')

    // 3. Une annonce en attente est invisible de la recherche ; l'admin la valide (RG17, RG24)
    expect(await rechercherAnnonces(filtresVides(), 1, null)).toHaveLength(0)
    await connecterComme('aicha@test.local')
    await expect(validerAnnonce(annonceId)).rejects.toThrow('Action non autorisée') // un étudiant ne valide pas
    await connecterComme('admin@test.local')
    await validerAnnonce(annonceId)
    await deciderPhoto(7, 'valider')
    expect(base.tables.photos![0]!.statut).toBe('validee')

    // 4. Recherche en liste et sur la carte : l'annonce apparaît, jamais avec sa position exacte (RG23)
    const liste = await rechercherAnnonces({ ...filtresVides(), type: 'appartement', loyerMax: '100000' }, 1, null)
    expect(liste.map((a) => a.id)).toEqual([annonceId])
    expect(await rechercherAnnonces({ ...filtresVides(), type: 'studio' }, 1, null)).toHaveLength(0)
    const carte = await annoncesCarte({ sud: 13.4, ouest: 2.0, nord: 13.6, est: 2.2 }, filtresVides(), 1)
    expect(carte).toHaveLength(1)
    expect(carte[0]!.zoneRayonM).toBe(150)
    expect(carte[0]!.latitude).not.toBe(ENTREE.latitude)
    expect(carte[0]!.longitude).not.toBe(ENTREE.longitude)

    // 5. Un étudiant contacte l'annonceur : messagerie interne, puis numéro seulement s'il est autorisé (RG19, RG32)
    await connecterComme('aicha@test.local')
    expect(await lireContactAnnonce(annonceId)).toEqual({ telephone: null, whatsapp: null })
    const conversation = await demarrerConversation(annonceId, 'Bonjour, le logement est-il disponible ?')
    expect(conversation).toBe(1)
    await expect(demarrerConversation(99, 'Bonjour')).rejects.toThrow('n\'est plus disponible')

    // 6. Groupe de colocation : Aïcha le lance, Awa le rejoint, le groupe est complet (RG34 à RG38)
    await expect(creerGroupe(annonceId, 3, '', '')).rejects.toThrow('Trop de colocataires')
    const groupe = await creerGroupe(annonceId, 1, 'Nous cherchons un colocataire sérieux.', 'Non fumeur')
    await connecterComme('awa@test.local')
    const vus = await groupesDuLogement(annonceId)
    expect(vus).toHaveLength(1)
    expect(vus[0]!.placesRestantes).toBe(1)
    await demanderAdhesion(groupe)
    await expect(repondreDemande(2000, true)).rejects.toThrow('Seul l\'initiateur') // pas l'étudiante qui demande
    await connecterComme('aicha@test.local')
    const demande = base.tables.membres!.find((m) => m.user_id === base.tables.profils!.find((p) => p.email === 'awa@test.local')!.id)!
    await repondreDemande(Number(demande.id), true)
    expect(base.tables.groupes![0]!.statut).toBe('complet')
    await connecterComme('awa@test.local')
    expect(await groupesDuLogement(annonceId)).toHaveLength(0) // un groupe complet n'est plus proposé
    await expect(demanderAdhesion(groupe)).rejects.toThrow('complet')

    // 7. Signalement traité : l'annonceur est signalé, l'admin prend en charge et suspend l'auteur (RG20, RGA12, RGA08)
    await connecterComme('aicha@test.local')
    await signaler('annonce', String(annonceId), 'arnaque', 'Il demande un acompte avant la visite.')
    await expect(signaler('annonce', String(annonceId), 'arnaque', '')).rejects.toThrow('déjà signalé')
    await connecterComme('admin@test.local')
    await prendreEnCharge(1)
    await expect(prendreEnCharge(1)).rejects.toThrow('déjà pris en charge')
    await expect(cloturer(1, 'suspendre_auteur', '')).rejects.toThrow('motif')
    await cloturer(1, 'suspendre_auteur', 'Demande d\'acompte frauduleuse')

    // 8. Le compte suspendu ne peut plus se connecter, et son annonce disparaît de la recherche (RG08)
    expect(base.tables.profils!.find((p) => p.email === 'proprio@test.local')!.statut).toBe('suspendu')
    await expect(connecterComme('proprio@test.local')).rejects.toThrow('Compte suspendu')
    await connecterComme('aicha@test.local')
    expect(await rechercherAnnonces(filtresVides(), 1, null)).toHaveLength(0)
  })

  it('refuse un étudiant qui publie un logement entier et plus de cinq photos', async () => {
    await inscrire(donnees('etudiant', 'aicha@test.local', 'Aicha'), 'jeton', '1.0')
    await connecterComme('aicha@test.local')
    const moi = String(base.utilisateur!.id)
    await expect(creerAnnonce(moi, { ...formulaireVide('studio'), titre: 'Studio à louer', description: 'Un studio calme près du campus universitaire.', partMensuelle: '50000', quartierId: '5' })).rejects.toThrow('place en colocation')
    const colocation = { ...formulaireVide('place_colocation'), titre: 'Place chez des étudiants', description: 'Une place dans une colocation calme et propre.', partMensuelle: '30000', loyerTotal: '90000', quartierId: '5' }
    const id = await creerAnnonce(moi, colocation)
    for (let i = 1; i <= 5; i++) await ajouterPhoto(id, i)
    await expect(ajouterPhoto(id, 6)).rejects.toThrow('5 photos au maximum')
  })
})
