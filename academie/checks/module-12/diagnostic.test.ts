/**
 * Module 12 : Diagnostic, la course acceptée deux fois.
 *
 * Aux modules 9 et 10, vos demandes et vos acceptations ont passé toutes leurs
 * vérifications. Elles envoyaient les demandes une par une. Celles-ci les
 * envoient en même temps.
 *
 * Une implémentation qui lit puis écrit laisse une fenêtre entre les deux :
 *
 * - deux chauffeurs qui touchent « Accepter » à la même seconde voient les deux
 *   demandes lire « sans chauffeur », et partent tous les deux chercher le
 *   même passager;
 * - la même demande envoyée cinq fois, par un double appui ou un réseau qui
 *   réessaie, peut créer plusieurs courses;
 * - un chauffeur qui accepte quatre demandes d'un coup peut les voir toutes
 *   passer : chaque acceptation a lu « il n'a pas de course en cours » avant
 *   que les autres n'écrivent.
 *
 * Aucun test séquentiel ne voit ces défauts. La garantie doit venir de la base :
 * une mise à jour conditionnelle, une contrainte d'unicité, et un verrou sur le
 * chauffeur pendant la transaction d'acceptation.
 *
 * Contrat attendu, exporté par `src/academie/module-12.ts` : les fonctions des
 * modules 9 et 10, que vous réexportez.
 *
 *   export function createAccount(input?: { ...ceux du module 6 }): Promise<string>
 *   export function createDriver(input?: { ...ceux du module 7 })
 *   export function requestRide(input: { ...ceux du module 9 })
 *   export function ridesOf(riderId: string)                                // module 9
 *   export function createRequestedRide(input?: { ...ceux du module 10 })
 *   export function acceptRide(input: { rideId; driverId; now })            // module 10
 *   export function assignedDriver(rideId: string): Promise<string | null>  // module 10
 */
import { describe, expect, it } from 'vitest'
import {
  acceptRide,
  assignedDriver,
  createAccount,
  createDriver,
  createRequestedRide,
  requestRide,
  ridesOf,
} from '../../../src/academie/module-12'
import { TANA, north, somewhere } from '../_support/positions'

async function driverNear(spot: { latitude: number; longitude: number }) {
  return (await createDriver({ position: spot })).driverId
}

describe('demandes simultanées', { timeout: 60_000 }, () => {
  // Le test que seule une garantie de la base fait passer de façon fiable.
  it('ne confie une course qu’à un chauffeur quand deux l’acceptent au même instant', async () => {
    const races = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const pickup = somewhere()
        const { rideId } = await createRequestedRide({ pickup })
        return { rideId, drivers: [await driverNear(pickup), await driverNear(pickup)] }
      }),
    )

    const now = new Date().toISOString()
    const responses = await Promise.all(
      races.flatMap(({ rideId, drivers }) =>
        drivers.map(async (driverId) => ({ rideId, driverId, ...(await acceptRide({ rideId, driverId, now })) })),
      ),
    )

    const winners = responses.filter((response) => response.status === 200)
    expect(winners, 'une acceptation réussie par course, pas deux').toHaveLength(races.length)
    for (const { rideId } of races) {
      const winner = winners.filter((response) => response.rideId === rideId)
      expect(winner, 'ni zéro chauffeur, ni deux : exactement un par course').toHaveLength(1)
      expect(await assignedDriver(rideId), 'le chauffeur enregistré est celui qui a reçu 200').toBe(winner[0]?.driverId)
    }
  })

  it('ne crée qu’une course quand la même demande arrive cinq fois', async () => {
    const riderId = await createAccount()
    const input = {
      riderId,
      pickup: TANA,
      dropoff: north(5),
      pickupLabel: 'Analakely, devant la pharmacie',
      dropoffLabel: 'Ivandry, entrée du centre commercial',
      category: 'voiture',
      now: new Date().toISOString(),
      idempotencyKey: `double-appui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }

    const results = await Promise.all(Array.from({ length: 5 }, () => requestRide(input)))

    expect(new Set(results.map((result) => result.rideId)).size, 'les cinq réponses désignent la même course').toBe(1)
    expect(await ridesOf(riderId), 'une seule course enregistrée').toHaveLength(1)
  })

  it('ne laisse un chauffeur accepter qu’une course sur quatre demandées en même temps', async () => {
    const spot = somewhere()
    const driverId = await driverNear(spot)
    const rides = await Promise.all(Array.from({ length: 4 }, () => createRequestedRide({ pickup: spot })))

    const now = new Date().toISOString()
    const results = await Promise.all(rides.map(({ rideId }) => acceptRide({ rideId, driverId, now })))

    expect(results.filter((result) => result.status === 200)).toHaveLength(1)
    const carried = (await Promise.all(rides.map(({ rideId }) => assignedDriver(rideId)))).filter((id) => id === driverId)
    expect(carried, 'une course à la fois').toHaveLength(1)
  })
})
