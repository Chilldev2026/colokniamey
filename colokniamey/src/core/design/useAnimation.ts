// Animations du module D : API Web Animations du navigateur, sans bibliothèque.
// Règles : seulement transform et opacity ; aucune animation ne retarde une action ;
// tout est coupé si l'utilisateur a demandé « réduire les animations ».

import { onBeforeUnmount } from 'vue'

export const DUREES = { rapide: 150, normale: 250, lente: 400 } as const
export const COURBE = 'cubic-bezier(0, 0, 0.2, 1)'

export function animationsReduites(): boolean {
  // Si le navigateur ne sait pas répondre, on évite d'animer par prudence
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true
}

type Duree = keyof typeof DUREES

export function useAnimation() {
  const enCours = new Set<Animation>()

  /** Joue une animation sur un élément. Rend la main tout de suite : l'action n'attend jamais. */
  function animer(
    element: Element,
    images: Keyframe[],
    duree: Duree = 'normale',
    options: KeyframeAnimationOptions = {},
  ): Animation | null {
    if (animationsReduites() || typeof element.animate !== 'function') return null
    const animation = element.animate(images, {
      duration: DUREES[duree],
      easing: COURBE,
      fill: 'both',
      ...options,
    })
    enCours.add(animation)
    void animation.finished
      .catch(() => undefined)
      .finally(() => enCours.delete(animation))
    return animation
  }

  /** Apparition en cascade : chaque élément démarre un peu après le précédent. */
  function cascade(elements: Element[], decalageMs = 50): void {
    elements.forEach((el, i) => {
      animer(el, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], 'normale', {
        delay: Math.min(i, 8) * decalageMs,
      })
    })
  }

  /** Léger rebond pour une feuille ou un cœur : dépasse un peu sa taille finale puis se stabilise. */
  function rebond(element: Element): Animation | null {
    return animer(
      element,
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.25)', offset: 0.4 },
        { transform: 'scale(0.95)', offset: 0.7 },
        { transform: 'scale(1)' },
      ],
      'normale',
    )
  }

  /** Marqueur qui tombe sur la carte. */
  function tomber(element: Element): Animation | null {
    return animer(
      element,
      [
        { opacity: 0, transform: 'translateY(-24px)' },
        { opacity: 1, transform: 'translateY(0)', offset: 0.7 },
        { transform: 'translateY(-4px)', offset: 0.85 },
        { transform: 'translateY(0)' },
      ],
      'lente',
    )
  }

  /** Pulsation continue (recherche GPS). Renvoie l'animation pour pouvoir l'arrêter. */
  function pulser(element: Element): Animation | null {
    return animer(
      element,
      [
        { transform: 'scale(1)', opacity: 0.9 },
        { transform: 'scale(1.8)', opacity: 0 },
      ],
      'lente',
      { iterations: Infinity, duration: 1200 },
    )
  }

  /** Cercle de précision qui se resserre autour du point trouvé. */
  function resserrer(element: Element): Animation | null {
    return animer(
      element,
      [
        { transform: 'scale(2.5)', opacity: 0.2 },
        { transform: 'scale(1)', opacity: 0.45 },
      ],
      'lente',
    )
  }

  onBeforeUnmount(() => {
    enCours.forEach((a) => a.cancel())
    enCours.clear()
  })

  return { animer, cascade, rebond, tomber, pulser, resserrer }
}
