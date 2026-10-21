/**
 * Module 6 : Le chauffeur, son véhicule et sa photo.
 *
 * Avant de monter dans une voiture, le passager veut savoir qui vient le
 * chercher : le prénom du chauffeur, sa photo, la marque, la couleur et la
 * plaque du véhicule. Il ne voit jamais son courriel ni son téléphone.
 *
 * Contrat attendu, exporté par `src/academie/module-6.ts` :
 *
 *   export function createAccount(input?: {
 *     name?: string                       // par défaut 'Compte'
 *     email?: string                      // par défaut un courriel inventé
 *     phone?: string                      // facultatif
 *     roles?: ('RIDER' | 'DRIVER')[]      // par défaut ['RIDER']
 *     driverStatus?: 'NONE' | 'PENDING' | 'APPROVED'   // par défaut 'NONE'
 *   }): Promise<string>                   // l'identifiant d'un compte actif
 *
 *   export function categories(): Promise<{ slug: string; name: string; seats: number }[]>
 *
 *   export function normalizePlate(raw: string): string | null
 *                                         // '1234 TBA', ou null si la plaque n'est pas valide
 *
 *   export function registerVehicle(input: {
 *     driverId: string
 *     category: string                    // le slug d'une catégorie
 *     make: string; model: string         // 'Toyota', 'Vitz'
 *     color: string                       // 'Blanche'
 *     year: number
 *     plate: string                       // telle que le chauffeur l'a tapée
 *   }): Promise<{ status: number; vehicleId?: string; reason?: string }>
 *                                         // 201; 200 s'il remplace son véhicule; 400; 403; 409
 *
 *   export function driverCard(driverId: string): Promise<null | {
 *     driverId: string
 *     firstName: string                   // le prénom seul
 *     photo: string | null                // la clé de la photo
 *     vehicle: null | { category: string; make: string; model: string; color: string; plate: string }
 *   }>                                    // null si le compte n'existe pas
 *
 *   export function createUploadUrl(input: {
 *     driverId: string; contentType: string; sizeBytes: number
 *   }): Promise<
 *     | { url: string; key: string; expiresAt: string }   // ISO 8601
 *     | { refused: string }                               // motif lisible
 *   >
 *
 *   export function attachPhoto(input: { driverId: string; key: string }):
 *     Promise<{ attached: boolean; reason?: string }>
 *
 * Règles imposées par la consigne, que cette suite vérifie :
 *   - les trois catégories sont celles de la décision 0001, avec leur nombre
 *     de places;
 *   - une plaque se range sous une seule forme (décision 0008) : quatre
 *     chiffres, une espace, puis deux ou trois lettres majuscules;
 *   - seul un compte qui a le rôle DRIVER enregistre un véhicule, qu'il soit
 *     encore en attente de vérification ou déjà vérifié;
 *   - la marque et le modèle font de 2 à 40 caractères, la couleur de 2 à 30,
 *     l'année est un entier de 2000 à l'année prochaine;
 *   - un chauffeur a un véhicule : en enregistrer un autre remplace le premier;
 *   - une plaque n'appartient qu'à un chauffeur : 409 pour un autre;
 *   - la fiche du chauffeur ne montre que son prénom, jamais son nom de
 *     famille, son courriel ni son téléphone;
 *   - un chauffeur a une photo au plus : une nouvelle remplace l'ancienne;
 *   - seuls `image/jpeg`, `image/png` et `image/webp` sont acceptés, un fichier
 *     de plus de 5 000 000 octets est refusé, et l'URL de téléversement
 *     expire dans les deux heures.
 *
 * Les photos passent par votre port « stockage » : en local et dans ces
 * vérifications, un stockage simulé qui écrit sur le disque; en production,
 * Supabase Storage. Ces vérifications n'envoient aucun fichier : `attachPhoto`
 * n'a pas à vérifier que le fichier a bien été téléversé.
 */
import { describe, expect, it } from 'vitest'
import {
  attachPhoto,
  categories,
  createAccount,
  createUploadUrl,
  driverCard,
  normalizePlate,
  registerVehicle,
} from '../../../src/academie/module-6'

const maxBytes = 5_000_000

/** Une plaque que personne d'autre n'emploie : quatre chiffres et trois lettres tirés au hasard. */
function uniquePlate() {
  const digits = String(Math.floor(Math.random() * 10_000)).padStart(4, '0')
  const letters = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('')
  return `${digits} ${letters}`
}

function driver(name = 'Haja Rakoto', driverStatus: 'PENDING' | 'APPROVED' = 'APPROVED') {
  return createAccount({ name, roles: ['RIDER', 'DRIVER'], driverStatus })
}

function validVehicle(driverId: string, overrides: Partial<Parameters<typeof registerVehicle>[0]> = {}) {
  return {
    driverId,
    category: 'voiture',
    make: 'Toyota',
    model: 'Vitz',
    color: 'Blanche',
    year: 2016,
    plate: uniquePlate(),
    ...overrides,
  }
}

describe('les catégories', () => {
  it('forment la liste de la décision 0001, avec leur nombre de places', async () => {
    const list = await categories()
    const seats = Object.fromEntries(list.map((category) => [category.slug, category.seats]))
    expect(seats).toMatchObject({ moto: 1, voiture: 4, familiale: 6 })
    expect(list.every((category) => category.name.trim().length > 0), 'chaque catégorie a un nom').toBe(true)
  })
})

describe('la plaque d’immatriculation', () => {
  it('ramène les écritures courantes à la même forme', () => {
    for (const raw of ['1234 TBA', '1234tba', '1234-TBA', '  1234   tba ', '1234 tba']) {
      expect(normalizePlate(raw), `« ${raw} »`).toBe('1234 TBA')
    }
    expect(normalizePlate('0042 ta')).toBe('0042 TA')
  })

  it('refuse une plaque qui n’a pas la forme attendue', () => {
    for (const raw of ['', '123 TBA', '12345 TBA', 'TBA 1234', '1234 T', '1234 TBAA', '12A4 TBA', '1234 TB1']) {
      expect(normalizePlate(raw), `« ${raw} »`).toBeNull()
    }
  })
})

describe('l’enregistrement du véhicule', () => {
  it('enregistre le véhicule d’un chauffeur, que sa fiche montre', async () => {
    const driverId = await driver()
    const result = await registerVehicle(validVehicle(driverId, { plate: `  ${uniquePlate().toLowerCase()} `, make: 'Suzuki', model: 'Alto' }))
    expect(result.status).toBe(201)
    expect(result.vehicleId, 'un véhicule enregistré porte un identifiant').toBeTruthy()
  })

  it('range la plaque sous sa forme unique', async () => {
    const driverId = await driver()
    const plate = uniquePlate()
    await registerVehicle(validVehicle(driverId, { plate: plate.toLowerCase().replace(' ', '-') }))
    expect((await driverCard(driverId))?.vehicle).toMatchObject({ plate, category: 'voiture', make: 'Toyota', model: 'Vitz', color: 'Blanche' })
  })

  // Le véhicule est ce que l'équipe vérifie : il s'enregistre avant l'approbation.
  it('laisse un chauffeur en attente de vérification enregistrer son véhicule', async () => {
    const driverId = await driver('Fara Rabe', 'PENDING')
    expect((await registerVehicle(validVehicle(driverId))).status).toBe(201)
  })

  it('refuse un compte qui n’est pas chauffeur, avec 403', async () => {
    const riderId = await createAccount()
    expect((await registerVehicle(validVehicle(riderId))).status).toBe(403)
  })

  it('refuse une catégorie, une marque, un modèle, une couleur, une année ou une plaque hors des règles, avec 400', async () => {
    const driverId = await driver()
    const cases = [
      { category: 'helicoptere' },
      { make: 'T' },
      { make: 'a'.repeat(41) },
      { model: ' ' },
      { color: 'B' },
      { year: 1999 },
      { year: new Date().getFullYear() + 2 },
      { year: 2016.5 },
      { plate: 'TBA 1234' },
    ]
    for (const overrides of cases) {
      const result = await registerVehicle(validVehicle(driverId, overrides))
      expect(result.status, JSON.stringify(overrides)).toBe(400)
      expect(result.reason, 'le refus doit porter un motif lisible').toBeTruthy()
    }
    expect((await driverCard(driverId))?.vehicle, 'un refus n’enregistre rien').toBeNull()
  })

  it('remplace le véhicule quand le chauffeur en enregistre un autre', async () => {
    const driverId = await driver()
    await registerVehicle(validVehicle(driverId))
    const second = await registerVehicle(validVehicle(driverId, { category: 'moto', make: 'Honda', model: 'CG 125', color: 'Rouge' }))

    expect(second.status).toBe(200)
    expect((await driverCard(driverId))?.vehicle).toMatchObject({ category: 'moto', make: 'Honda', color: 'Rouge' })
  })

  it('refuse la plaque d’un autre chauffeur avec 409, et la laisse à son chauffeur', async () => {
    const plate = uniquePlate()
    const owner = await driver()
    expect((await registerVehicle(validVehicle(owner, { plate }))).status).toBe(201)

    const other = await driver('Mamy Rasoa')
    const taken = await registerVehicle(validVehicle(other, { plate: plate.toLowerCase() }))
    expect(taken.status).toBe(409)
    expect(taken.reason).toBeTruthy()

    expect((await registerVehicle(validVehicle(owner, { plate, color: 'Grise' }))).status, 'le même chauffeur garde sa plaque').toBe(200)
  })
})

describe('la fiche du chauffeur', () => {
  it('montre le prénom seul, la photo et le véhicule', async () => {
    const driverId = await driver('Haja Rakotomalala')
    const card = await driverCard(driverId)
    expect(card).toMatchObject({ driverId, firstName: 'Haja', photo: null, vehicle: null })
  })

  it('rend null pour un compte qui n’existe pas', async () => {
    expect(await driverCard('00000000-0000-4000-8000-000000000000')).toBeNull()
  })

  // Le passager parle au chauffeur par l'application, pas par son téléphone personnel.
  it('ne montre jamais le nom de famille, le courriel ni le téléphone du chauffeur', async () => {
    const email = `chauffeur-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.org`
    const driverId = await createAccount({
      name: 'Haja Rakotomalala',
      email,
      phone: '034 98 765 43',
      roles: ['RIDER', 'DRIVER'],
      driverStatus: 'APPROVED',
    })
    await registerVehicle(validVehicle(driverId))

    const text = JSON.stringify(await driverCard(driverId))
    expect(text, 'le nom de famille reste sur le serveur').not.toContain('Rakotomalala')
    expect(text, 'le courriel du chauffeur reste sur le serveur').not.toContain(email)
    expect(text, 'le téléphone du chauffeur reste sur le serveur').not.toMatch(/98\s?765\s?43|987654/)
  })
})

describe('la photo du chauffeur', () => {
  it('accorde une URL signée au chauffeur, qui expire dans les deux heures', async () => {
    const driverId = await driver()
    const grant = await createUploadUrl({ driverId, contentType: 'image/webp', sizeBytes: 250_000 })

    expect('key' in grant, 'une image valide doit être acceptée').toBe(true)
    if (!('key' in grant)) return
    expect(grant.url).toMatch(/^https?:\/\/.+/)
    const expiresAt = new Date(grant.expiresAt).getTime()
    expect(Number.isNaN(expiresAt), 'expiresAt doit être une date ISO 8601').toBe(false)
    expect(expiresAt).toBeGreaterThan(Date.now())
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 7_200_000)
  })

  // Le type est décidé côté serveur : un client peut annoncer ce qu'il veut.
  it('refuse un fichier qui n’est pas une image, ou trop volumineux', async () => {
    const driverId = await driver()
    for (const contentType of ['application/pdf', 'text/html', 'video/mp4']) {
      const grant = await createUploadUrl({ driverId, contentType, sizeBytes: 100_000 })
      expect('refused' in grant, `${contentType} doit être refusé`).toBe(true)
    }
    const big = await createUploadUrl({ driverId, contentType: 'image/jpeg', sizeBytes: maxBytes + 1 })
    expect('refused' in big, 'un fichier de plus de 5 Mo doit être refusé').toBe(true)
  })

  it('refuse le téléversement à un compte qui n’est pas chauffeur', async () => {
    const grant = await createUploadUrl({ driverId: await createAccount(), contentType: 'image/jpeg', sizeBytes: 100_000 })
    expect('refused' in grant, 'seul un chauffeur a une photo de chauffeur').toBe(true)
  })

  it('montre la photo sur la fiche, et la remplace par la suivante', async () => {
    const driverId = await driver()
    const first = await createUploadUrl({ driverId, contentType: 'image/jpeg', sizeBytes: 100_000 })
    if (!('key' in first)) throw new Error(`téléversement refusé : ${first.refused}`)
    expect((await attachPhoto({ driverId, key: first.key })).attached).toBe(true)
    expect((await driverCard(driverId))?.photo).toBe(first.key)

    const second = await createUploadUrl({ driverId, contentType: 'image/png', sizeBytes: 100_000 })
    if (!('key' in second)) throw new Error(`téléversement refusé : ${second.refused}`)
    expect((await attachPhoto({ driverId, key: second.key })).attached).toBe(true)
    expect((await driverCard(driverId))?.photo, 'un chauffeur a une photo au plus').toBe(second.key)
  })

  it('refuse de reprendre la photo d’un autre chauffeur', async () => {
    const owner = await driver()
    const grant = await createUploadUrl({ driverId: owner, contentType: 'image/jpeg', sizeBytes: 100_000 })
    if (!('key' in grant)) throw new Error(`téléversement refusé : ${grant.refused}`)
    await attachPhoto({ driverId: owner, key: grant.key })

    const thief = await driver('Rado Rabe')
    const result = await attachPhoto({ driverId: thief, key: grant.key })
    expect(result.attached, 'une photo accordée à un autre chauffeur ne doit pas être reprise').toBe(false)
    expect((await driverCard(thief))?.photo).toBeNull()
  })
})
