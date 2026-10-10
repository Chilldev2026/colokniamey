// Favoris de la personne connectée (RG20 voisin : lecture et écriture limitées à son compte par la RLS).
// Le cœur change tout de suite ; si la base refuse, on revient en arrière et on prévient.
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { ajouterFavori, listerIdsFavoris, retirerFavori } from '../services/rechercheService'

export const useFavorisStore = defineStore('favoris', () => {
  const ids = ref<Set<number>>(new Set())
  const charge = ref(false)

  async function charger(): Promise<void> {
    ids.value = new Set(await listerIdsFavoris())
    charge.value = true
  }

  function estFavori(id: number): boolean {
    return ids.value.has(id)
  }

  /** Bascule l'état d'un favori. Renvoie une erreur lisible si la base refuse, sinon null. */
  async function basculer(id: number): Promise<string | null> {
    const etait = ids.value.has(id)
    const copie = new Set(ids.value)
    if (etait) copie.delete(id)
    else copie.add(id)
    ids.value = copie
    try {
      if (etait) await retirerFavori(id)
      else await ajouterFavori(id)
      return null
    } catch (e) {
      const retour = new Set(ids.value)
      if (etait) retour.add(id)
      else retour.delete(id)
      ids.value = retour
      return e instanceof Error ? e.message : 'Action impossible.'
    }
  }

  function vider() {
    ids.value = new Set()
    charge.value = false
  }

  return { ids, charge, charger, estFavori, basculer, vider }
})
