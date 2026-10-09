import type { Database } from '@/core/types/database'

export type Profil = Database['public']['Tables']['profils']['Row']

export type RaisonDeconnexion = 'inactivite' | 'suspendu' | null

export const LIBELLES_ROLE: Record<Profil['role'], string> = {
  etudiant: 'Étudiant',
  proprietaire: 'Propriétaire',
  admin: 'Administrateur',
  super_admin: 'Super-administrateur',
}
