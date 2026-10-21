/**
 * Module 8 : L'estimation du prix.
 *
 * Avant de demander une course, le passager choisit son départ et sa
 * destination, et voit le prix de chaque catégorie : la moto, la voiture, la
 * familiale. Ce prix doit être juste dès l'écran de choix, parce que c'est
 * celui qu'il paiera (module 9).
 *
 * Sans service de cartographie payant, l'estimation se fait à partir de la
 * distance à vol d'oiseau :
 *
 *   distance du trajet   la distance de haversine en mètres × 1,3, arrondie au
 *                        mètre le plus proche : les routes ne vont pas en
 *                        ligne droite
 *   durée                la distance du trajet à 25 km/h pour une moto, à
 *                        20 km/h pour une voiture ou une familiale, arrondie à
 *                        la seconde la plus proche
 *   prix                 le calcul du module 2, avec le tarif de la catégorie
 *                        lu dans la base, et le tarif de nuit à l'instant `at`
 *
 * Contrat attendu, exporté par `src/academie/module-8.ts` :
 *
 *   export function tariffs(): Promise<{
 *     category: string; base: number; perKm: number; perMinute: number; minimum: number
 *   }[]>                                  // lus dans la base
 *
 *   export function estimates(input: {
 *     pickup: { latitude: number; longitude: number }
 *     dropoff: { latitude: number; longitude: number }
 *     at: string                          // un instant ISO 8601
 *   }): Promise<{
 *     status: number                      // 200, ou 400
 *     reason?: string                     // présent quand status n'est pas 200
 *     items?: {
 *       category: string                  // dans l'ordre : moto, voiture, familiale
 *       distanceMeters: number; durationSeconds: number
 *       fare: number                      // en ariary
 *     }[]
 *   }>
 *
 * Une estimation est refusée avec 400 quand une position est impossible, quand
 * le départ et la destination sont à moins de 200 m l'un de l'autre à vol
 * d'oiseau, ou à plus de 40 km : l'application ne fait que des trajets en
 * ville et autour.
 */
import { describe, expect, it } from 'vitest'
import { estimates, tariffs } from '../../../src/academie/module-8'
import { TANA, inMadagascar, north } from '../_support/positions'

const midi = inMadagascar('2030-07-15', '12:00')
const nuit = inMadagascar('2030-07-15', '23:00')

function byCategory(items: { category: string }[] | undefined) {
  return Object.fromEntries((items ?? []).map((item) => [item.category, item]))
}

describe('les tarifs', () => {
  it('sont ceux de la décision 0001, lus dans la base', async () => {
    const rows = Object.fromEntries((await tariffs()).map(({ category, ...tariff }) => [category, tariff]))
    expect(rows).toMatchObject({
      moto: { base: 1_000, perKm: 400, perMinute: 50, minimum: 2_000 },
      voiture: { base: 2_000, perKm: 900, perMinute: 100, minimum: 5_000 },
      familiale: { base: 3_000, perKm: 1_300, perMinute: 150, minimum: 8_000 },
    })
  })
})

describe('l’estimation d’un trajet', () => {
  it('donne une estimation par catégorie, dans l’ordre moto, voiture, familiale', async () => {
    const result = await estimates({ pickup: TANA, dropoff: north(5), at: midi })
    expect(result.status).toBe(200)
    expect(result.items?.map((item) => item.category)).toEqual(['moto', 'voiture', 'familiale'])
  })

  // 5 km à vol d'oiseau : 6 500 m de route.
  it('allonge la distance de 30 %, et compte la durée selon la catégorie', async () => {
    const items = byCategory((await estimates({ pickup: TANA, dropoff: north(5), at: midi })).items)
    expect(items.moto).toMatchObject({ distanceMeters: 6_500, durationSeconds: 936 })
    expect(items.voiture).toMatchObject({ distanceMeters: 6_500, durationSeconds: 1_170 })
    expect(items.familiale).toMatchObject({ distanceMeters: 6_500, durationSeconds: 1_170 })
  })

  it('calcule le prix de chaque catégorie avec son tarif', async () => {
    const items = byCategory((await estimates({ pickup: TANA, dropoff: north(5), at: midi })).items)
    expect(items.moto?.fare).toBe(4_400)
    expect(items.voiture?.fare).toBe(9_800)
    expect(items.familiale?.fare).toBe(14_400)
  })

  it('applique le tarif de nuit à l’heure de Madagascar', async () => {
    const items = byCategory((await estimates({ pickup: TANA, dropoff: north(5), at: nuit })).items)
    expect(items.moto?.fare).toBe(5_300)
    expect(items.voiture?.fare).toBe(11_800)
    expect(items.familiale?.fare).toBe(17_300)
  })

  it('applique le minimum de chaque catégorie à un trajet court', async () => {
    const items = byCategory((await estimates({ pickup: TANA, dropoff: north(1), at: midi })).items)
    expect(items.moto).toMatchObject({ distanceMeters: 1_300, durationSeconds: 187, fare: 2_000 })
    expect(items.voiture?.fare).toBe(5_000)
    expect(items.familiale?.fare).toBe(8_000)
  })

  it('mesure la distance sur la Terre, pas en degrés', async () => {
    // 0,0935 degré vers l'est : 9 836 m à vol d'oiseau à cette latitude, 12 787 m de route.
    const east = { latitude: TANA.latitude, longitude: TANA.longitude + 0.0935 }
    const items = byCategory((await estimates({ pickup: TANA, dropoff: east, at: midi })).items)
    expect(items.voiture?.distanceMeters).toBeGreaterThan(12_780)
    expect(items.voiture?.distanceMeters).toBeLessThan(12_795)
  })

  it('rend des montants entiers, en centaines rondes', async () => {
    const result = await estimates({ pickup: TANA, dropoff: { latitude: -18.8792, longitude: 47.5079 }, at: midi })
    for (const item of result.items ?? []) {
      expect(Number.isInteger(item.fare), `${item.fare} doit être un entier`).toBe(true)
      expect(item.fare % 100).toBe(0)
      expect(Number.isInteger(item.distanceMeters) && Number.isInteger(item.durationSeconds)).toBe(true)
    }
  })
})

describe('les trajets refusés', () => {
  it('refuse un départ et une destination à moins de 200 m, avec 400 et un motif', async () => {
    const result = await estimates({ pickup: TANA, dropoff: north(0.15), at: midi })
    expect(result.status).toBe(400)
    expect(result.reason, 'le refus doit porter un motif lisible').toBeTruthy()
    expect(result.items).toBeUndefined()

    expect((await estimates({ pickup: TANA, dropoff: north(0.25), at: midi })).status, '250 m suffisent').toBe(200)
  })

  it('refuse un trajet de plus de 40 km, avec 400 et un motif', async () => {
    const result = await estimates({ pickup: TANA, dropoff: north(41), at: midi })
    expect(result.status).toBe(400)
    expect(result.reason).toBeTruthy()

    expect((await estimates({ pickup: TANA, dropoff: north(39), at: midi })).status, '39 km passent').toBe(200)
  })

  it('refuse une position impossible, avec 400', async () => {
    for (const dropoff of [
      { latitude: -91, longitude: 47.5 },
      { latitude: -18.9, longitude: 181 },
      { latitude: Number.NaN, longitude: 47.5 },
    ]) {
      expect((await estimates({ pickup: TANA, dropoff, at: midi })).status, JSON.stringify(dropoff)).toBe(400)
    }
  })
})
