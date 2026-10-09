// Icônes Lucide uniquement (trait de 2 px, couleur du texte). Les entrées de menu
// désignent une icône par son nom ; seules celles listées ici sont embarquées.
import type { Component } from 'vue'
import {
  Download,
  Heart,
  House,
  Map as CarteIcone,
  MessageSquare,
  User,
  Users,
  X,
  Check,
  Info,
  TriangleAlert,
  Search,
  MapPin,
  ShieldCheck,
  Menu as MenuIcone,
  LogOut,
  KeyRound,
  UserCog,
  ClipboardList,
  Bell,
  Settings,
} from 'lucide-vue-next'

export const icones: Record<string, Component> = {
  accueil: House,
  carte: CarteIcone,
  favoris: Heart,
  messages: MessageSquare,
  profil: User,
  groupes: Users,
  telecharger: Download,
  fermer: X,
  valide: Check,
  info: Info,
  attention: TriangleAlert,
  recherche: Search,
  position: MapPin,
  admin: ShieldCheck,
  menu: MenuIcone,
  deconnexion: LogOut,
  securite: KeyRound,
  utilisateurs: Users,
  administrateurs: UserCog,
  file: ClipboardList,
  relance: Bell,
  parametres: Settings,
}

export type NomIcone = keyof typeof icones
