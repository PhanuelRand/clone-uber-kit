/**
 * Module 7 : Les chauffeurs proches.
 *
 * Le passager ouvre l'application et voit, sur la carte, les chauffeurs
 * disponibles autour de lui. Un chauffeur se met en ligne, puis son téléphone
 * envoie sa position régulièrement. Une position trop ancienne ne dit plus où
 * il est : il a peut-être coupé son téléphone au milieu d'un embouteillage.
 *
 * Contrat attendu, exporté par `src/academie/module-7.ts` :
 *
 *   export function createAccount(input?: { ...ceux du module 6 }): Promise<string>
 *
 *   export function distanceKm(
 *     from: { latitude: number; longitude: number },
 *     to: { latitude: number; longitude: number },
 *   ): number                            // la distance exacte, sans arrondi
 *
 *   export function createDriver(input?: {
 *     category?: string                  // par défaut 'voiture'
 *     position?: { latitude: number; longitude: number }   // par défaut le centre d'Antananarivo
 *     online?: boolean                   // par défaut true
 *     reportedAt?: string                // l'instant de sa dernière position; par défaut maintenant
 *     driverStatus?: 'PENDING' | 'APPROVED'   // par défaut 'APPROVED'
 *   }): Promise<{ driverId: string }>    // un chauffeur, avec son véhicule, à cette position
 *
 *   export function goOnline(input: {
 *     driverId: string; latitude: number; longitude: number; now: string
 *   }): Promise<{ status: number }>      // 200; 403 si ce n'est pas un chauffeur vérifié; 409 sans véhicule
 *
 *   export function goOffline(input: { driverId: string }): Promise<{ status: number }>
 *
 *   export function reportPosition(input: {
 *     driverId: string; latitude: number; longitude: number; now: string
 *   }): Promise<{ status: number }>      // 200; 400 pour une position impossible; 403 si ce n'est pas un chauffeur vérifié
 *
 *   export function nearbyDrivers(input: {
 *     near: { latitude: number; longitude: number }   // la position du passager
 *     category?: string
 *     now: string                        // un instant ISO 8601
 *     radiusKm?: number                  // par défaut 5; jamais plus de 10
 *   }): Promise<{
 *     items: {
 *       category: string
 *       distanceKm: number               // arrondie au dixième
 *       approximate: { latitude: number; longitude: number }   // arrondie au millième de degré
 *     }[]
 *   }>
 *
 * La distance se mesure sur la Terre, en suivant sa courbure : la formule de
 * haversine, avec un rayon terrestre de 6 371 km. Un degré de longitude ne
 * vaut pas un degré de latitude, et Madagascar est dans l'hémisphère sud : ses
 * latitudes sont négatives.
 *
 * Un chauffeur apparaît quand il est en ligne, vérifié, actif, avec un
 * véhicule, à `radiusKm` du passager au plus, et que sa dernière position date
 * de moins de deux minutes à l'instant `now`, sans être postérieure à `now`.
 * Les plus proches viennent d'abord, dix au plus.
 *
 * La liste ne dit jamais qui sont les chauffeurs : ni identifiant, ni nom, ni
 * plaque. Leur position est arrondie au millième de degré, environ cent mètres :
 * assez pour les voir sur la carte, pas assez pour savoir devant quelle maison
 * ils attendent.
 */
import { describe, expect, it } from 'vitest'
import {
  createAccount,
  createDriver,
  distanceKm,
  goOffline,
  goOnline,
  nearbyDrivers,
  reportPosition,
} from '../../../src/academie/module-7'
import { TANA, north, somewhere, uniqueInstant } from '../_support/positions'

/** Un instant `seconds` secondes avant `instant`. */
function before(instant: string, seconds: number) {
  return new Date(new Date(instant).getTime() - seconds * 1_000).toISOString()
}

async function driverAt(position: { latitude: number; longitude: number }, now: string, extra: Parameters<typeof createDriver>[0] = {}) {
  return (await createDriver({ position, reportedAt: now, ...extra })).driverId
}

describe('la distance sur la Terre', () => {
  it('compte un degré de latitude pour environ 111,2 km', () => {
    expect(distanceKm(TANA, north(10))).toBeCloseTo(10, 2)
  })

  // Le piège classique : multiplier les degrés par 111 dans les deux directions.
  it('compte un degré de longitude pour moins à cette latitude', () => {
    const east = { latitude: TANA.latitude, longitude: TANA.longitude + 0.0935 }
    expect(distanceKm(TANA, east)).toBeCloseTo(9.84, 1)
  })

  it('rend zéro entre un point et lui-même, et la même distance dans les deux sens', () => {
    const spot = somewhere()
    expect(distanceKm(spot, spot)).toBe(0)
    expect(distanceKm(spot, north(3, spot))).toBeCloseTo(distanceKm(north(3, spot), spot), 9)
  })
})

describe('les chauffeurs autour du passager', () => {
  it('montre les chauffeurs en ligne près du passager, les plus proches d’abord', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    await driverAt(north(1.5, spot), now)
    await driverAt(north(0.5, spot), now)
    await driverAt(north(3, spot), now)

    const items = (await nearbyDrivers({ near: spot, now })).items
    expect(items.map((item) => item.distanceKm)).toEqual([0.5, 1.5, 3])
    expect(items.every((item) => item.category === 'voiture')).toBe(true)
  })

  it('cache les chauffeurs au-delà du rayon, de 5 km par défaut et de 10 km au plus', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    await driverAt(north(4, spot), now)
    await driverAt(north(7, spot), now)
    await driverAt(north(12, spot), now)

    expect((await nearbyDrivers({ near: spot, now })).items.map((item) => item.distanceKm)).toEqual([4])
    expect((await nearbyDrivers({ near: spot, now, radiusKm: 10 })).items.map((item) => item.distanceKm)).toEqual([4, 7])
    expect(
      (await nearbyDrivers({ near: spot, now, radiusKm: 50 })).items.map((item) => item.distanceKm),
      'un rayon de 50 km se ramène à 10',
    ).toEqual([4, 7])
  })

  it('mesure la distance sur la Terre, pas en degrés', async () => {
    const now = uniqueInstant()
    const spot = { latitude: TANA.latitude, longitude: 45 + Math.random() * 3 }
    await driverAt({ latitude: spot.latitude, longitude: spot.longitude + 0.0935 }, now)

    const items = (await nearbyDrivers({ near: spot, now, radiusKm: 10 })).items
    expect(items.map((item) => item.distanceKm)).toEqual([9.8])
  })

  it('filtre par catégorie', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    await driverAt(north(1, spot), now, { category: 'moto' })
    await driverAt(north(2, spot), now, { category: 'voiture' })
    await driverAt(north(3, spot), now, { category: 'familiale' })

    const motos = (await nearbyDrivers({ near: spot, now, category: 'moto' })).items
    expect(motos.map((item) => [item.category, item.distanceKm])).toEqual([['moto', 1]])
    expect((await nearbyDrivers({ near: spot, now })).items).toHaveLength(3)
  })

  it('rend dix chauffeurs au plus', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    for (let index = 0; index < 12; index += 1) await driverAt(north(0.2 + index * 0.3, spot), now)

    const items = (await nearbyDrivers({ near: spot, now })).items
    expect(items).toHaveLength(10)
    expect(items[0]?.distanceKm).toBe(0.2)
  })
})

describe('les chauffeurs cachés', () => {
  it('cache un chauffeur hors ligne, ou en attente de vérification', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    await driverAt(north(1, spot), now, { online: false })
    await driverAt(north(2, spot), now, { driverStatus: 'PENDING' })

    expect((await nearbyDrivers({ near: spot, now })).items).toEqual([])
  })

  // Une position de plus de deux minutes ne dit plus où est le chauffeur.
  it('cache un chauffeur dont la position date de deux minutes ou plus', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    await driverAt(north(1, spot), before(now, 119))
    await driverAt(north(2, spot), before(now, 120))
    await driverAt(north(3, spot), before(now, 600))

    expect((await nearbyDrivers({ near: spot, now })).items.map((item) => item.distanceKm)).toEqual([1])
  })

  it('cache un chauffeur dont la position est postérieure à l’instant demandé', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    await driverAt(north(1, spot), before(now, -30))

    expect((await nearbyDrivers({ near: spot, now })).items).toEqual([])
  })

  it('cache un chauffeur qui se met hors ligne, et le montre de nouveau en ligne', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    const driverId = await driverAt(north(1, spot), now)

    expect((await goOffline({ driverId })).status).toBe(200)
    expect((await nearbyDrivers({ near: spot, now })).items).toEqual([])

    const position = north(2, spot)
    expect((await goOnline({ driverId, ...position, now })).status).toBe(200)
    expect((await nearbyDrivers({ near: spot, now })).items.map((item) => item.distanceKm)).toEqual([2])
  })

  it('suit la dernière position envoyée', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    const driverId = await driverAt(north(4, spot), before(now, 30))

    expect((await reportPosition({ driverId, ...north(1, spot), now })).status).toBe(200)
    expect((await nearbyDrivers({ near: spot, now })).items.map((item) => item.distanceKm)).toEqual([1])
  })
})

describe('ce que le passager voit des chauffeurs', () => {
  it('ne dit pas qui ils sont, et arrondit leur position au millième de degré', async () => {
    const now = uniqueInstant()
    const spot = somewhere()
    const position = north(1.234, spot)
    const driverId = await driverAt(position, now)

    const items = (await nearbyDrivers({ near: spot, now })).items
    expect(items).toHaveLength(1)
    expect(items[0]?.approximate).toEqual({
      latitude: Number(position.latitude.toFixed(3)),
      longitude: Number(position.longitude.toFixed(3)),
    })
    const text = JSON.stringify(items)
    expect(text, 'l’identifiant du chauffeur reste sur le serveur').not.toContain(driverId)
    expect(text, 'la position exacte reste sur le serveur').not.toContain(position.latitude.toFixed(5))
    expect(Object.keys(items[0] ?? {}).join(' '), 'ni nom ni plaque').not.toMatch(/name|nom|plate|plaque|phone|email/i)
  })
})

describe('se mettre en ligne', () => {
  it('refuse un chauffeur sans véhicule avec 409, et un chauffeur en attente avec 403', async () => {
    const now = new Date().toISOString()
    const withoutVehicle = await createAccount({ roles: ['RIDER', 'DRIVER'], driverStatus: 'APPROVED' })
    expect((await goOnline({ driverId: withoutVehicle, ...somewhere(), now })).status).toBe(409)

    const pending = await createAccount({ roles: ['RIDER', 'DRIVER'], driverStatus: 'PENDING' })
    expect((await goOnline({ driverId: pending, ...somewhere(), now })).status).toBe(403)
  })

  it('refuse une position impossible avec 400, et celle d’un passager avec 403', async () => {
    const now = new Date().toISOString()
    const { driverId } = await createDriver({ position: somewhere() })
    expect((await reportPosition({ driverId, latitude: -91, longitude: 47, now })).status).toBe(400)
    expect((await reportPosition({ driverId, latitude: -18.9, longitude: 181, now })).status).toBe(400)

    const riderId = await createAccount()
    expect((await reportPosition({ driverId: riderId, latitude: -18.9, longitude: 47.5, now })).status).toBe(403)
  })
})
