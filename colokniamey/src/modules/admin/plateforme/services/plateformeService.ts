// Seul endroit du sous-module « plateforme » qui appelle Supabase.
import { supabase } from '@/core/supabase'
import { messageErreur } from '../../services/adminService'

export interface ParametreLu {
  valeur: unknown
  publique: boolean
  modifieLe: string
}

/** Lecture de tous les paramètres (admins en lecture seule, super-admin pour modifier). */
export async function listerParametres(): Promise<Record<string, ParametreLu>> {
  const { data, error } = await supabase.rpc('liste_parametres')
  if (error) throw new Error(messageErreur(error))
  return Object.fromEntries(data.map((p) => [p.cle, { valeur: p.valeur, publique: p.publique, modifieLe: p.modifie_le }]))
}

/** RGA15 : réservé au super-admin (la base le revérifie) et journalisé. */
export async function definirMaintenance(active: boolean, message: string, fin: string | null): Promise<void> {
  const { error } = await supabase.rpc('definir_maintenance', {
    p_active: active,
    p_message: message,
    // les types générés n'acceptent pas un argument nul : sans date de fin, on n'envoie pas l'argument
    ...(fin ? { p_fin: fin } : {}),
  })
  if (error) throw new Error(messageErreur(error))
}

/** RGA17 : réservé au super-admin (la base le revérifie) et journalisé. */
export async function modifierParametre(cle: string, valeur: boolean | number | string): Promise<void> {
  const { error } = await supabase.rpc('modifier_parametre', { p_cle: cle, p_valeur: valeur })
  if (error) throw new Error(messageErreur(error))
}
