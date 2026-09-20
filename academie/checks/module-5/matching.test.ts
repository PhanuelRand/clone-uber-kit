/**
 * Module 5 — Matching et acceptation.
 *
 * Le critère central du parcours : une course a au plus un chauffeur, même
 * sous acceptations simultanées. Une lecture suivie d'une écriture ne suffit
 * pas — il faut une garantie de la base (contrainte unique ou mise à jour
 * conditionnelle).
 *
 * Interface attendue, exportée par `src/matching/rides.ts` :
 *
 *   export async function createRide(input: {
 *     passengerId: string; fareCents: number
 *   }): Promise<string>
 *
 *   export async function acceptRide(input: {
 *     rideId: string; driverId: string
 *   }): Promise<{ accepted: boolean }>
 *
 *   export async function getRide(rideId: string):
 *     Promise<{ status: string; driverId: string | null }>
 */
import { describe, expect, it } from 'vitest'
import { acceptRide, createRide, getRide } from '../../../src/matching/rides'

const passengerId = '22222222-2222-4222-8222-222222222222'

describe('acceptation d’une course', () => {
  it('affecte le chauffeur qui accepte', async () => {
    const rideId = await createRide({ passengerId, fareCents: 1500 })
    const result = await acceptRide({ rideId, driverId: 'driver-1' })

    expect(result.accepted).toBe(true)
    expect((await getRide(rideId)).driverId).toBe('driver-1')
  })

  it('désigne exactement un gagnant parmi des acceptations simultanées', async () => {
    const rideId = await createRide({ passengerId, fareCents: 1500 })

    const results = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) =>
        acceptRide({ rideId, driverId: `driver-${index}` }),
      ),
    )

    expect(results.filter((result) => result.accepted)).toHaveLength(1)
    expect((await getRide(rideId)).driverId).not.toBeNull()
  })

  it('refuse une acceptation tardive sur une course déjà prise', async () => {
    const rideId = await createRide({ passengerId, fareCents: 1500 })
    await acceptRide({ rideId, driverId: 'driver-1' })

    const late = await acceptRide({ rideId, driverId: 'driver-2' })
    expect(late.accepted).toBe(false)
    expect((await getRide(rideId)).driverId).toBe('driver-1')
  })
})
