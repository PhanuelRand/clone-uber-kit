/**
 * Module 13 : Le suivi en temps réel.
 *
 * Le passager suit sa course sans recharger la page : acceptée, chauffeur
 * arrivé, commencée, terminée. Dès qu'un chauffeur a accepté, il le voit venir
 * sur la carte, puis avancer pendant le trajet. Deux règles font la différence
 * entre un suivi et une fuite de données :
 *
 * - seuls le passager et le chauffeur de la course la suivent, et le serveur
 *   le vérifie à chaque lecture et à chaque abonnement;
 * - la position du chauffeur n'est montrée qu'au passager, et seulement
 *   pendant la course : de l'acceptation à l'arrivée à destination. Avant, ou
 *   après, elle dirait où il habite et où il va.
 *
 * Contrat attendu, exporté par `src/academie/module-13.ts` :
 *
 *   export function createAccount(input?: { ...ceux du module 6 }): Promise<string>
 *   export function createDriver(input?: { ...ceux du module 7 })
 *   export function createRequestedRide(input?: { ...ceux du module 10 })
 *   export function acceptRide, arrive, startRide, completeRide, cancelRide   // module 10
 *   export function reportPosition(input: { ...ceux du module 7 })
 *
 *   export function trackRide(input: { rideId: string; viewerId: string }): Promise<{
 *     status: number                  // 200, ou 403 pour un tiers
 *     ride?: {
 *       status: string                // le statut de la course : 'ACCEPTED', 'IN_PROGRESS'…
 *       driverPosition: { latitude: number; longitude: number } | null
 *     }
 *   }>
 *
 *   export type TrackingEvent =
 *     | { seq: number; type: 'STATUS'; status: string }
 *     | { seq: number; type: 'POSITION'; latitude: number; longitude: number }
 *
 *   export function subscribe(input: {
 *     rideId: string; viewerId: string
 *     onEvent: (event: TrackingEvent) => void
 *   }): Promise<{ status: number; unsubscribe: () => void }>
 *
 *   export function applyEvent(
 *     state: { seq: number; status: string; driverPosition: { latitude: number; longitude: number } | null },
 *     event: TrackingEvent,
 *   ): typeof state
 *
 * Chaque événement d'une course porte un numéro, `seq`, qui augmente. Un
 * changement de statut envoie un événement STATUS au passager et au chauffeur
 * abonnés. Une position envoie un événement POSITION au seul passager, et
 * seulement quand la course est acceptée, le chauffeur arrivé, ou la course
 * commencée.
 *
 * `applyEvent` est ce que l'interface fait d'un événement reçu : elle ignore un
 * numéro déjà appliqué ou plus ancien, et applique un événement plus récent.
 * Après une coupure, l'interface relit `trackRide`, puis reprend les
 * événements. Un abonnement refusé rend quand même une fonction `unsubscribe`,
 * qui ne fait rien.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  acceptRide,
  applyEvent,
  arrive,
  cancelRide,
  completeRide,
  createAccount,
  createDriver,
  createRequestedRide,
  reportPosition,
  startRide,
  subscribe,
  trackRide,
  type TrackingEvent,
} from '../../../src/academie/module-13'
import { somewhere } from '../_support/positions'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

const now = () => new Date().toISOString()

/** Une course demandée, et un chauffeur vérifié tout près. */
async function requested() {
  const pickup = somewhere()
  const ride = await createRequestedRide({ pickup })
  const { driverId } = await createDriver({ position: pickup })
  return { ...ride, pickup, driverId }
}

async function accepted() {
  const ride = await requested()
  await acceptRide({ rideId: ride.rideId, driverId: ride.driverId, now: now() })
  return ride
}

/** Enregistre les événements reçus par un abonné. */
async function listen(rideId: string, viewerId: string) {
  const events: TrackingEvent[] = []
  const subscription = await subscribe({ rideId, viewerId, onEvent: (event) => events.push(event) })
  cleanups.push(subscription.unsubscribe)
  // Laisse le temps à l'abonnement d'être en place.
  await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  return { status: subscription.status, events }
}

/** Attend qu'une condition soit vraie, ou échoue au bout de trois secondes. */
async function eventually(check: () => boolean, message: string) {
  const deadline = Date.now() + 3_000
  while (!check()) {
    if (Date.now() > deadline) throw new Error(message)
    await new Promise((resolveWait) => setTimeout(resolveWait, 25))
  }
}

function statuses(events: TrackingEvent[]) {
  return events.flatMap((event) => (event.type === 'STATUS' ? [event.status] : []))
}

describe('qui suit une course', () => {
  it('ouvre le suivi au passager et au chauffeur de la course', async () => {
    const { rideId, riderId, driverId } = await accepted()
    for (const viewerId of [riderId, driverId]) {
      const tracked = await trackRide({ rideId, viewerId })
      expect(tracked.status).toBe(200)
      expect(tracked.ride?.status).toBe('ACCEPTED')
    }
  })

  it('refuse le suivi et l’abonnement à un tiers, et à un autre chauffeur, avec 403', async () => {
    const { rideId, pickup } = await accepted()
    const otherDriver = (await createDriver({ position: pickup })).driverId
    for (const viewerId of [await createAccount(), otherDriver]) {
      const tracked = await trackRide({ rideId, viewerId })
      expect(tracked.status).toBe(403)
      expect(tracked.ride).toBeUndefined()
      expect((await listen(rideId, viewerId)).status).toBe(403)
    }
  })
})

describe('les changements de statut, en temps réel', () => {
  it('préviennent le passager dès qu’un chauffeur accepte, puis quand il arrive', async () => {
    const { rideId, riderId, driverId } = await requested()
    const rider = await listen(rideId, riderId)
    expect(rider.status).toBe(200)

    await acceptRide({ rideId, driverId, now: now() })
    await arrive({ rideId, driverId })
    await eventually(() => statuses(rider.events).length >= 2, 'aucun statut reçu en 3 s')

    expect(statuses(rider.events)).toEqual(['ACCEPTED', 'ARRIVED'])
    const numbered = rider.events.filter((event) => event.type === 'STATUS')
    expect(numbered[1]?.seq ?? 0, 'les numéros augmentent').toBeGreaterThan(numbered[0]?.seq ?? 0)
  })

  it('préviennent aussi le chauffeur, quand le passager annule', async () => {
    const { rideId, riderId, driverId } = await accepted()
    const driver = await listen(rideId, driverId)
    await cancelRide({ rideId, memberId: riderId, now: now() })
    await eventually(() => statuses(driver.events).includes('CANCELLED'), 'le chauffeur n’a rien reçu en 3 s')
  })
})

describe('la position du chauffeur', () => {
  it('reste cachée tant qu’aucun chauffeur n’a accepté', async () => {
    const { rideId, riderId, driverId, pickup } = await requested()
    await reportPosition({ driverId, ...pickup, now: now() })
    expect((await trackRide({ rideId, viewerId: riderId })).ride?.driverPosition).toBeNull()
  })

  it('se montre au passager dès l’acceptation, pendant l’approche et pendant le trajet', async () => {
    const { rideId, riderId, driverId, startCode } = await accepted()
    await reportPosition({ driverId, latitude: -18.9012, longitude: 47.5234, now: now() })
    expect((await trackRide({ rideId, viewerId: riderId })).ride?.driverPosition).toEqual({ latitude: -18.9012, longitude: 47.5234 })

    await arrive({ rideId, driverId })
    await startRide({ rideId, driverId, code: startCode })
    await reportPosition({ driverId, latitude: -18.8901, longitude: 47.5301, now: now() })
    const during = await trackRide({ rideId, viewerId: riderId })
    expect(during.ride?.status).toBe('IN_PROGRESS')
    expect(during.ride?.driverPosition).toEqual({ latitude: -18.8901, longitude: 47.5301 })
  })

  it('arrive en temps réel chez le passager, et chez lui seul', async () => {
    const { rideId, riderId, driverId, pickup } = await accepted()
    const rider = await listen(rideId, riderId)
    const driver = await listen(rideId, driverId)
    // Un autre passager, dont la demande attend près du même chauffeur, n'en reçoit rien.
    const neighbour = await createRequestedRide({ pickup })
    const stranger = await listen(neighbour.rideId, neighbour.riderId)

    await reportPosition({ driverId, latitude: -18.905, longitude: 47.53, now: now() })
    await eventually(() => rider.events.some((event) => event.type === 'POSITION'), 'aucune position reçue en 3 s')
    expect(rider.events.find((event) => event.type === 'POSITION')).toMatchObject({ type: 'POSITION', latitude: -18.905, longitude: 47.53 })

    await new Promise((resolveWait) => setTimeout(resolveWait, 300))
    expect(driver.events.filter((event) => event.type === 'POSITION'), 'le chauffeur sait déjà où il est').toEqual([])
    expect(stranger.events.filter((event) => event.type === 'POSITION')).toEqual([])
  })

  it('disparaît une fois la course terminée, ou annulée', async () => {
    const done = await accepted()
    await reportPosition({ driverId: done.driverId, latitude: -18.9, longitude: 47.52, now: now() })
    await arrive({ rideId: done.rideId, driverId: done.driverId })
    await startRide({ rideId: done.rideId, driverId: done.driverId, code: done.startCode })
    await completeRide({ rideId: done.rideId, driverId: done.driverId, now: now() })
    const finished = await trackRide({ rideId: done.rideId, viewerId: done.riderId })
    expect(finished.ride?.status).toBe('COMPLETED')
    expect(finished.ride?.driverPosition).toBeNull()

    const cancelled = await accepted()
    await reportPosition({ driverId: cancelled.driverId, latitude: -18.9, longitude: 47.52, now: now() })
    await cancelRide({ rideId: cancelled.rideId, memberId: cancelled.riderId, now: now() })
    expect((await trackRide({ rideId: cancelled.rideId, viewerId: cancelled.riderId })).ride?.driverPosition).toBeNull()
  })

  it('ne part plus vers le passager après la fin de la course', async () => {
    const { rideId, riderId, driverId, startCode } = await accepted()
    await arrive({ rideId, driverId })
    await startRide({ rideId, driverId, code: startCode })
    await completeRide({ rideId, driverId, now: now() })
    const rider = await listen(rideId, riderId)

    await reportPosition({ driverId, latitude: -18.91, longitude: 47.51, now: now() })
    await new Promise((resolveWait) => setTimeout(resolveWait, 300))
    expect(rider.events.filter((event) => event.type === 'POSITION')).toEqual([])
  })
})

describe('reprendre après une coupure', () => {
  const start = { seq: 4, status: 'IN_PROGRESS', driverPosition: { latitude: -18.9, longitude: 47.5 } }

  it('applique un événement plus récent', () => {
    expect(applyEvent(start, { seq: 5, type: 'POSITION', latitude: -18.91, longitude: 47.51 })).toEqual({
      seq: 5,
      status: 'IN_PROGRESS',
      driverPosition: { latitude: -18.91, longitude: 47.51 },
    })
    expect(applyEvent(start, { seq: 5, type: 'STATUS', status: 'COMPLETED' })).toMatchObject({ seq: 5, status: 'COMPLETED' })
  })

  it('ignore un événement déjà appliqué, ou plus ancien', () => {
    expect(applyEvent(start, { seq: 4, type: 'POSITION', latitude: 0, longitude: 0 })).toEqual(start)
    expect(applyEvent(start, { seq: 2, type: 'STATUS', status: 'ACCEPTED' })).toEqual(start)
  })
})
