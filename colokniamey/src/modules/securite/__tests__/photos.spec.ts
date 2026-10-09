import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn<(nom: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>>(() =>
    Promise.resolve({ data: null, error: null }),
  ),
  upload: vi.fn<(chemin: string, blob: Blob, options: unknown) => Promise<{ error: null }>>(() => Promise.resolve({ error: null })),
}))

vi.mock('@/core/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: { getUser: () => Promise.resolve({ data: { user: { id: '11111111-1111-1111-1111-111111111111' } } }) },
    storage: { from: () => ({ upload: mocks.upload }) },
  },
}))

import { dhashDepuisGris, distanceHamming } from '../images/dhash'
import { contientMetadonnees } from '../images/metadonnees'
import { detecterTypeImage } from '../images/signature'
import { traiterImage, ErreurPhoto, type ImageDecodee, type MoteurImage, type ParametresPhoto } from '../images/traitement'
import { messageErreurContenu, televerserPhoto } from '../services/securiteService'
import EnvoiPhoto from '../components/EnvoiPhoto.vue'

const PARAMS: ParametresPhoto = { tailleMaxOctets: 10 * 1048576, dimensionMin: 400, seuilNsfw: 0.7 }

const octets = (...valeurs: number[]) => new Uint8Array(valeurs)
const texte = (s: string) => Array.from(s, (c) => c.charCodeAt(0))

/** Un JPEG factice qui porte un bloc EXIF avec une position GPS. */
function jpegAvecGps(): File {
  const contenu = octets(0xff, 0xd8, 0xff, 0xe1, 0x00, 0x20, ...texte('Exif'), 0, 0, ...texte('GPSLatitude=13.51;GPSLongitude=2.10'), 0xff, 0xd9)
  return new File([contenu], 'maison.jpg', { type: 'image/jpeg' })
}

/** Un WebP factice, tel que le produirait un canvas : aucune métadonnée. */
function webpPropre(taille = 100): Blob {
  const entete = octets(...texte('RIFF'), 0, 0, 0, 0, ...texte('WEBP'), ...texte('VP8 '))
  const corps = new Uint8Array(taille).fill(7)
  return new Blob([entete, corps], { type: 'image/webp' })
}

function moteur(surcharge: Partial<ImageDecodee> = {}): MoteurImage {
  return {
    decoder: () =>
      Promise.resolve({
        largeur: 1200,
        hauteur: 900,
        gris: new Uint8Array(72).map((_, i) => (i * 7) % 256),
        analyserNudite: () => Promise.resolve(0.01),
        encoder: () => Promise.resolve(webpPropre()),
        liberer: () => undefined,
        ...surcharge,
      }),
  }
}

describe('signature du fichier (RG48)', () => {
  it('reconnaît JPEG, PNG et WebP', () => {
    expect(detecterTypeImage(octets(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(detecterTypeImage(octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(detecterTypeImage(octets(...texte('RIFF'), 1, 2, 3, 4, ...texte('WEBP')))).toBe('image/webp')
  })

  it('refuse un fichier qui n\'est pas une image', () => {
    expect(detecterTypeImage(octets(...texte('%PDF-1.7 hello')))).toBeNull()
    expect(detecterTypeImage(octets(...texte('GIF89a......')))).toBeNull()
    expect(detecterTypeImage(new Uint8Array(0))).toBeNull()
  })

  it('refuse un fichier renommé en .jpg mais qui n\'est pas une image', async () => {
    const faux = new File(['<script>alert(1)</script>'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(traiterImage(faux, PARAMS, moteur())).rejects.toThrow(/n'est pas une photo/)
  })
})

describe('traitement de la photo (RG48, RG49, RG50)', () => {
  it('supprime les métadonnées EXIF et la position GPS', async () => {
    const entree = jpegAvecGps()
    const avant = new Uint8Array(await entree.arrayBuffer())
    expect(contientMetadonnees(avant)).toBe(true)

    const resultat = await traiterImage(entree, PARAMS, moteur())
    const apres = new Uint8Array(await resultat.blob.arrayBuffer())
    expect(contientMetadonnees(apres)).toBe(false)
    expect(detecterTypeImage(apres)).toBe('image/webp')
  })

  it('calcule une empreinte de 16 caractères hexadécimaux', async () => {
    const resultat = await traiterImage(jpegAvecGps(), PARAMS, moteur())
    expect(resultat.empreinte).toMatch(/^[0-9a-f]{16}$/)
  })

  it('refuse une photo trop lourde', async () => {
    await expect(traiterImage(jpegAvecGps(), { ...PARAMS, tailleMaxOctets: 10 }, moteur())).rejects.toThrow(/trop lourde/)
  })

  it('refuse une photo trop petite', async () => {
    const petite = moteur({ largeur: 300, hauteur: 900 })
    await expect(traiterImage(jpegAvecGps(), PARAMS, petite)).rejects.toThrow(/trop petite/)
  })

  it('refuse immédiatement une photo au-dessus du seuil de nudité, sans en dire plus', async () => {
    const explicite = moteur({ analyserNudite: () => Promise.resolve(0.93) })
    const erreur = await traiterImage(jpegAvecGps(), PARAMS, explicite).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurPhoto)
    expect((erreur as Error).message).toMatch(/règles de ColokNiamey/)
    expect((erreur as Error).message).not.toMatch(/nu|porn|explicite/i)
  })

  it('continue si l\'analyse est indisponible : la validation humaine reste le garde-fou (RG49)', async () => {
    const sansAnalyse = moteur({ analyserNudite: () => Promise.resolve(null) })
    await expect(traiterImage(jpegAvecGps(), PARAMS, sansAnalyse)).resolves.toBeDefined()
  })

  it('réduit la taille tant que le résultat dépasse la limite des buckets', async () => {
    const tailles: number[] = []
    const lourd = moteur({
      encoder: (cote) => {
        tailles.push(cote)
        return Promise.resolve(cote > 1000 ? webpPropre(4 * 1048576) : webpPropre())
      },
    })
    await traiterImage(jpegAvecGps(), PARAMS, lourd)
    expect(tailles).toEqual([1600, 1200, 800])
  })

  it('libère l\'image même en cas de refus', async () => {
    const liberer = vi.fn<() => void>()
    await traiterImage(jpegAvecGps(), PARAMS, moteur({ largeur: 10, hauteur: 10, liberer })).catch(() => undefined)
    expect(liberer).toHaveBeenCalledTimes(1)
  })
})

describe('empreinte dHash (RG50)', () => {
  const degrade = Array.from({ length: 72 }, (_, i) => 255 - (i % 9) * 25)

  it('est stable et sensible au contenu', () => {
    expect(dhashDepuisGris(degrade)).toBe(dhashDepuisGris([...degrade]))
    expect(dhashDepuisGris(degrade)).toBe('ffffffffffffffff')
    expect(dhashDepuisGris([...degrade].reverse())).toBe('0000000000000000')
  })

  it('reste proche pour une image légèrement modifiée', () => {
    const legerementModifiee = degrade.map((v, i) => (i === 3 ? v - 2 : v + 1))
    expect(distanceHamming(dhashDepuisGris(degrade), dhashDepuisGris(legerementModifiee))).toBeLessThanOrEqual(4)
  })

  it('compte les bits différents', () => {
    expect(distanceHamming('ffffffffffffffff', 'fffffffffffffff0')).toBe(4)
    expect(distanceHamming('0000000000000000', 'ffffffffffffffff')).toBe(64)
  })

  it('exige 72 niveaux de gris', () => {
    expect(() => dhashDepuisGris([1, 2, 3])).toThrow(/72 niveaux/)
  })
})

describe('envoi vers Storage (RG49, RGP21)', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.upload.mockClear()
  })

  it('dépose la photo dans le dossier de l\'auteur puis l\'enregistre', async () => {
    mocks.rpc.mockResolvedValue({ data: 42, error: null })
    const id = await televerserPhoto(webpPropre(), 'avatar', 'aaaaaaaaaaaaaaaa')
    expect(id).toBe(42)
    const chemin = mocks.upload.mock.calls[0]![0]
    expect(chemin).toMatch(/^11111111-1111-1111-1111-111111111111\/[0-9a-f-]{36}\.webp$/)
    expect(mocks.rpc).toHaveBeenCalledWith('enregistrer_photo', expect.objectContaining({ p_usage: 'avatar', p_empreinte: 'aaaaaaaaaaaaaaaa' }))
  })

  it('montre les messages français de la base et cache les autres', () => {
    expect(messageErreurContenu({ code: 'P0001', message: 'Cette image a déjà été refusée par la modération.' })).toMatch(/déjà été refusée/)
    expect(messageErreurContenu({ code: '23505', message: 'duplicate key value violates unique constraint "photos_chemin_key"' })).toBe(
      'Une erreur est survenue. Réessaie dans un moment.',
    )
  })
})

describe('composant EnvoiPhoto', () => {
  it('refuse un faux fichier image et n\'envoie rien', async () => {
    mocks.upload.mockClear()
    const w = mount(EnvoiPhoto, { props: { usage: 'avatar' } })
    const entree = w.find('input[type=file]')
    Object.defineProperty(entree.element, 'files', {
      value: [new File(['pas une image'], 'photo.jpg', { type: 'image/jpeg' })],
      configurable: true,
    })
    await entree.trigger('change')
    await flushPromises()
    expect(w.text()).toMatch(/n'est pas une photo/)
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
