/**
 * Module 6 — Suivi de la course en temps réel.
 *
 * Interface attendue, exportée par `src/realtime/ride-channel.ts` :
 *
 *   export async function canSubscribe(input: {
 *     rideId: string; viewerId: string
 *   }): Promise<boolean>
 *
 *   export async function rideSnapshot(rideId: string):
 *     Promise<{ status: string; driverPosition: { lat: number; lon: number } | null }>
 *
 *   export function applyEvent(state: unknown, event: unknown): unknown
 */
import { describe, expect, it } from 'vitest'
import {
  applyEvent,
  canSubscribe,
  rideSnapshot,
} from '../../../src/realtime/ride-channel'
import { acceptRide, createRide } from '../../../src/matching/rides'

const passengerId = '33333333-3333-4333-8333-333333333333'

describe('autorisation du canal temps réel', () => {
  it('laisse le passager et le chauffeur de la course s’abonner', async () => {
    const rideId = await createRide({ passengerId, fareCents: 1500 })
    await acceptRide({ rideId, driverId: 'driver-1' })

    expect(await canSubscribe({ rideId, viewerId: passengerId })).toBe(true)
    expect(await canSubscribe({ rideId, viewerId: 'driver-1' })).toBe(true)
  })

  // L'autorisation doit être vérifiée à l'ouverture du canal, pas seulement
  // sur la première requête HTTP.
  it('refuse un tiers, même authentifié', async () => {
    const rideId = await createRide({ passengerId, fareCents: 1500 })
    expect(await canSubscribe({ rideId, viewerId: 'curieux' })).toBe(false)
  })
})

describe('reprise après coupure', () => {
  it('rend l’état courant de la course sans rejouer l’historique', async () => {
    const rideId = await createRide({ passengerId, fareCents: 1500 })
    const snapshot = await rideSnapshot(rideId)
    expect(snapshot.status).toBeTruthy()
  })

  it('absorbe un message livré deux fois sans corrompre l’état', () => {
    const event = { type: 'DRIVER_MOVED', lat: 45.5, lon: -73.56, seq: 7 }
    const once = applyEvent({ seq: 6 }, event)
    expect(applyEvent(once, event)).toEqual(once)
  })
})
