// Types partagés de l'espace admin (A2).
import type { RouteRecordRaw } from 'vue-router'
import type { EntreeMenuAdmin } from '@/core/modules/types'

/** Un sous-module admin (utilisateurs, modération, plateforme…) apporte des routes enfants de /admin. */
export interface SousModuleAdmin {
  nom: string
  /** Routes enfants de /admin : chemins relatifs, chacune déclare meta.roles et éventuellement meta.menuAdmin. */
  routes: RouteRecordRaw[]
}

export interface EntreeMenuCalculee extends EntreeMenuAdmin {
  /** Chemin complet de la route. */
  vers: string
  /** Rôles autorisés (copie de meta.roles). */
  roles: string[]
}

export interface EtatFile {
  nom: string
  libelle: string
  lien: string
  nombre: number
  plusAncien: string | null
}

export interface RelanceRecue {
  id: number
  creeLe: string
  motif: string | null
}

export interface FacteurTotp {
  id: string
  nom: string
  creeLe: string
  verifie: boolean
}

export interface InscriptionTotp {
  facteurId: string
  /** Image du QR code (data URL SVG), fournie par Supabase Auth. */
  qr: string
  /** Clé à saisir à la main si le QR code ne peut pas être lu. */
  secret: string
}
