// Contrat d'un module : ce que son index.ts expose à l'application.
// L'application (src/app) construit le router et le menu à partir de la liste des modules actifs.

import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

export type Role = 'etudiant' | 'proprietaire' | 'admin' | 'super_admin'

export interface EntreeMenu {
  libelle: string
  /** Chemin de la route. */
  vers: string
  /** Nom d'une icône Lucide, résolu par le layout. */
  icone?: string
  /** Rôles qui voient l'entrée. Absent = tout le monde, y compris les visiteurs. */
  roles?: Role[]
}

export interface DefinitionModule {
  /** Identifiant court, utilisé pour ranger les mesures par module. */
  nom: string
  /** Chaque route peut déclarer meta.roles : le garde et le menu s'en servent (RGA26). */
  routes: RouteRecordRaw[]
  menu: EntreeMenu[]
  /** Modules dont celui-ci dépend (leur index.ts uniquement). */
  dependances?: string[]
  /** Un module optionnel peut être retiré de la liste sans casser l'application. */
  optionnel?: boolean
  composantsGlobaux?: Record<string, Component>
}

declare module 'vue-router' {
  interface RouteMeta {
    /** Module propriétaire de la route (mesures). */
    module?: string
    /** Rôles autorisés ; absent = route publique. */
    roles?: Role[]
    /** Titre de la page. */
    titre?: string
    /** Reste affichable pendant la maintenance. */
    horsMaintenance?: boolean
    /** Renvoie vers la connexion si la personne n'est pas connectée. */
    connexionRequise?: boolean
    /** Réservée aux visiteurs : une personne connectée est renvoyée vers son espace. */
    visiteurSeulement?: boolean
  }
}
