// Points d'extension de l'interface. Un module optionnel y enregistre un composant ; la page hôte l'affiche sans
// dépendre du module (contrat d'indépendance : aucun import croisé). Exemple : M8 ajoute la section « groupes » au
// détail d'une annonce de M4. Sans le module, le point reste vide et la page fonctionne.
import type { Component } from 'vue'

const registre = new Map<string, Component[]>()

export function enregistrerExtension(point: string, composant: Component): void {
  const liste = registre.get(point) ?? []
  if (!liste.includes(composant)) registre.set(point, [...liste, composant])
}

export function extensions(point: string): Component[] {
  return registre.get(point) ?? []
}
