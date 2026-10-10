/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
}

// Événement non standard déclenché par Chrome et Edge pour proposer l'installation (RG26)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}

interface Navigator {
  // Propriété propre à Safari sur iPhone : vrai si l'app est lancée depuis l'écran d'accueil
  standalone?: boolean
}

/** Date de construction, injectée par vite.config.ts (A6). */
declare const __VERSION_APP__: string | undefined
