import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { contraste } from '../design/contraste'
import DesignSystemView from '../views/DesignSystemView.vue'

// Lit une couleur dans tokens.css pour que le test suive les jetons réels.
// (Vitest vide les fichiers .css importés : on lit le fichier directement.)
const css = readFileSync(resolve(process.cwd(), 'src/core/design/tokens.css'), 'utf8')
function jeton(nom: string): string {
  const m = new RegExp(`--${nom}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)
  if (!m?.[1]) throw new Error(`Jeton introuvable : ${nom}`)
  return m[1]
}

describe('contrastes du texte (WCAG, 4,5:1 minimum)', () => {
  const paires: [string, string, string][] = [
    ['encre', 'fond', 'texte sur le fond'],
    ['encre', 'surface', 'texte sur une surface'],
    ['texte-secondaire', 'fond', 'texte secondaire sur le fond'],
    ['texte-secondaire', 'surface', 'texte secondaire sur une surface'],
    ['indigo', 'fond', 'liens indigo sur le fond'],
    ['indigo', 'surface', 'liens indigo sur une surface'],
    ['indigo', 'indigo-pale', 'texte indigo sur indigo pâle'],
    ['surface', 'indigo', 'bouton principal'],
    ['surface', 'indigo-fonce', 'bouton principal au survol'],
    ['surface', 'orange', 'bouton d\'action'],
    ['orange', 'surface', 'entrée active de la barre de navigation'],
    ['surface', 'vert', 'badge Vérifiée'],
    ['surface', 'erreur', 'bouton danger'],
    ['erreur', 'surface', 'message d\'erreur'],
    ['surface', 'encre', 'toast'],
  ]

  it.each(paires)('%s sur %s : %s', (texte, fond) => {
    expect(contraste(jeton(texte), jeton(fond))).toBeGreaterThanOrEqual(4.5)
  })

  it('l\'orange de décor n\'est pas utilisé pour du texte (contraste insuffisant, c\'est voulu)', () => {
    expect(contraste(jeton('orange-decor'), jeton('surface'))).toBeLessThan(4.5)
  })
})

describe('règles du module D dans les jetons', () => {
  it('ne contient ni ombre portée ni dégradé', () => {
    expect(css).not.toMatch(/box-shadow|text-shadow|drop-shadow|gradient\(/i)
  })
})

describe('/design-system', () => {
  it('s\'affiche sans erreur', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:chemin(.*)*', component: { template: '<div />' } }],
    })
    router.push('/design-system')
    await router.isReady()

    const page = mount(DesignSystemView, { global: { plugins: [router] } })
    await flushPromises()

    expect(page.text()).toContain('Design system')
    expect(page.findAll('button').length).toBeGreaterThan(5)
  })
})
