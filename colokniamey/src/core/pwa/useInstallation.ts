// Installation de l'application (RG26) : bouton natif sur Android et ordinateur (Chrome, Edge),
// guide Safari sur iPhone, bouton masqué si l'application est déjà installée.

import { computed, ref } from 'vue'

const evenementInstall = ref<BeforeInstallPromptEvent | null>(null)
const dejaInstallee = ref(false)
let initialise = false

export function estModeInstalle(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

export function estIphone(agent: string = navigator.userAgent): boolean {
  return /iphone|ipad|ipod/i.test(agent)
}

function initialiser() {
  if (initialise) return
  initialise = true
  dejaInstallee.value = estModeInstalle()

  window.addEventListener('beforeinstallprompt', (e) => {
    // On garde l'événement pour le déclencher quand l'utilisateur clique
    e.preventDefault()
    evenementInstall.value = e
  })
  window.addEventListener('appinstalled', () => {
    dejaInstallee.value = true
    evenementInstall.value = null
  })
}

export function useInstallation() {
  initialiser()

  const iphone = estIphone()
  const natifDisponible = computed(() => evenementInstall.value !== null)
  // Visible si l'installation native est possible, ou sur iPhone (guide Safari)
  const afficherBouton = computed(
    () => !dejaInstallee.value && (natifDisponible.value || iphone),
  )

  async function installer(): Promise<'accepted' | 'dismissed' | 'guide'> {
    if (!evenementInstall.value) return 'guide'
    await evenementInstall.value.prompt()
    const { outcome } = await evenementInstall.value.userChoice
    evenementInstall.value = null
    return outcome
  }

  return { afficherBouton, natifDisponible, iphone, dejaInstallee, installer }
}
