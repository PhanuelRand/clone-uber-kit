/**
 * Module 3 — Géolocalisation et carte temps réel.
 *
 * Interface attendue, exportée par `src/geo/drivers.ts` :
 *
 *   export async function recordPosition(input: {
 *     driverId: string; lat: number; lon: number; at: Date
 *   }): Promise<void>
 *
 *   export async function findNearbyDrivers(input: {
 *     lat: number; lon: number; radiusKm: number; now: Date
 *   }): Promise<{ driverId: string; distanceKm: number }[]>
 */
import { describe, expect, it } from 'vitest'
import { findNearbyDrivers, recordPosition } from '../../../src/geo/drivers'

const montreal = { lat: 45.5019, lon: -73.5674 }
const now = new Date('2026-01-01T12:00:00Z')

describe('recherche de proximité', () => {
  it('classe les chauffeurs du plus proche au plus loin', async () => {
    await recordPosition({ driverId: 'loin', lat: 45.55, lon: -73.6, at: now })
    await recordPosition({ driverId: 'proche', lat: 45.503, lon: -73.568, at: now })

    const found = await findNearbyDrivers({ ...montreal, radiusKm: 10, now })
    const ids = found.map((driver) => driver.driverId)
    expect(ids.indexOf('proche')).toBeLessThan(ids.indexOf('loin'))
  })

  it('rend une distance cohérente avec la position', async () => {
    await recordPosition({ driverId: 'proche', lat: 45.503, lon: -73.568, at: now })
    const [first] = await findNearbyDrivers({ ...montreal, radiusKm: 10, now })
    expect(first?.distanceKm).toBeGreaterThanOrEqual(0)
    expect(first?.distanceKm).toBeLessThan(10)
  })

  it('exclut les chauffeurs hors du rayon demandé', async () => {
    await recordPosition({ driverId: 'quebec', lat: 46.8139, lon: -71.208, at: now })
    const found = await findNearbyDrivers({ ...montreal, radiusKm: 5, now })
    expect(found.map((driver) => driver.driverId)).not.toContain('quebec')
  })

  // Une position vieille de vingt minutes ne dit plus où est la voiture.
  it('exclut les positions périmées', async () => {
    await recordPosition({
      driverId: 'perime',
      lat: 45.503,
      lon: -73.568,
      at: new Date(now.getTime() - 20 * 60_000),
    })
    const found = await findNearbyDrivers({ ...montreal, radiusKm: 10, now })
    expect(found.map((driver) => driver.driverId)).not.toContain('perime')
  })
})
