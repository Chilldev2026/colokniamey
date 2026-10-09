// RGP19 : le formulaire n'envoie rien sans jeton Turnstile (Supabase refuse aussi côté serveur).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'

const mocks = vi.hoisted(() => ({
  signUp: vi.fn<(args: unknown) => Promise<{ error: null }>>(() => Promise.resolve({ error: null })),
}))

vi.mock('@/core/supabase', () => ({
  supabase: {
    auth: { signUp: mocks.signUp },
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}))

// Le sélecteur d'université interroge M1 : on le remplace par un simple champ
vi.mock('@/modules/referentiel', () => ({
  SelecteurUniversite: defineComponent({ props: ['modelValue'], template: '<span />' }),
}))

import InscriptionView from '../views/InscriptionView.vue'

const TurnstileFaux = defineComponent({
  emits: ['jeton'],
  template: '<button type="button" data-test="jeton" @click="$emit(\'jeton\', \'jeton-ok\')">robot</button>',
  methods: { reinitialiser() { /* rien */ } },
})

function monter() {
  return mount(InscriptionView, {
    global: {
      stubs: { TurnstileWidget: TurnstileFaux, RouterLink: true },
    },
  })
}

async function remplir(w: ReturnType<typeof monter>) {
  const champs = w.findAll('input:not([type=radio]):not([type=checkbox])')
  const valeurs = ['Aminata', 'Issoufou', 'aminata@example.com', '90123456', 'Zebre-Violet-84']
  for (const [i, v] of valeurs.entries()) await champs[i]!.setValue(v)
  await w.find('input[type=checkbox]').setValue(true)
}

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.signUp.mockClear()
  // Étudiant : l'université est obligatoire ; on teste ici le propriétaire pour isoler le jeton
})

afterEach(() => vi.unstubAllEnvs())

describe('inscription et Turnstile (RGP19)', () => {
  it('refuse l\'envoi sans jeton quand la clé Turnstile est configurée', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'cle-publique-test')
    const w = monter()
    await w.findAll('input[type=radio]')[1]!.setValue(true) // propriétaire
    await remplir(w)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.signUp).not.toHaveBeenCalled()
    expect(w.text()).toMatch(/anti-robots/)
  })

  it('envoie l\'inscription avec le jeton, rôle propriétaire et version des conditions', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'cle-publique-test')
    const w = monter()
    await w.findAll('input[type=radio]')[1]!.setValue(true)
    await remplir(w)
    await w.find('[data-test=jeton]').trigger('click')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.signUp).toHaveBeenCalledTimes(1)
    const appel = mocks.signUp.mock.calls[0]![0] as { options: { captchaToken: string; data: Record<string, string> } }
    expect(appel.options.captchaToken).toBe('jeton-ok')
    expect(appel.options.data.role).toBe('proprietaire')
    expect(appel.options.data.cgu_version).not.toBe('')
  })

  it('n\'envoie rien si les conditions ne sont pas cochées (RGP12)', async () => {
    const w = monter()
    await w.findAll('input[type=radio]')[1]!.setValue(true)
    await remplir(w)
    await w.find('input[type=checkbox]').setValue(false)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.signUp).not.toHaveBeenCalled()
  })

  it('ne propose que les rôles étudiant et propriétaire (RG03)', () => {
    const w = monter()
    const valeurs = w.findAll('input[type=radio]').map((r) => (r.element as HTMLInputElement).value)
    expect(valeurs).toEqual(['etudiant', 'proprietaire'])
  })
})
