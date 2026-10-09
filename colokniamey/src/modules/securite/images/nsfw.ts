// RG49 : analyse de nudité dans le navigateur avec nsfwjs (licence MIT).
// Le modèle MobileNetV2 est embarqué dans le paquet de l'application et chargé seulement au moment
// du premier envoi : il est donc servi par notre propre site, jamais par un serveur tiers (RGP12 bis).
// Cette analyse peut être contournée par un utilisateur averti : c'est la validation humaine
// par un admin qui garantit le résultat (RG49). Si le modèle ne se charge pas, on renvoie null
// et l'envoi continue : la photo reste de toute façon en attente de validation.

import type { NSFWJS } from 'nsfwjs/core'

let modele: Promise<NSFWJS | null> | null = null

async function charger(): Promise<NSFWJS | null> {
  try {
    const [{ load }, { MobileNetV2Model }] = await Promise.all([
      import('nsfwjs/core'),
      import('nsfwjs/models/mobilenet_v2'),
    ])
    return await load('MobileNetV2', { modelDefinitions: [MobileNetV2Model] })
  } catch {
    return null
  }
}

/** Probabilité (0 à 1) que l'image soit pornographique ou explicite, ou null si l'analyse est indisponible. */
export async function probabiliteNudite(image: HTMLCanvasElement): Promise<number | null> {
  modele ??= charger()
  const m = await modele
  if (!m) {
    modele = null // nouvel essai au prochain envoi
    return null
  }
  const predictions = await m.classify(image)
  return predictions
    .filter((p) => p.className === 'Porn' || p.className === 'Hentai')
    .reduce((total, p) => total + p.probability, 0)
}
