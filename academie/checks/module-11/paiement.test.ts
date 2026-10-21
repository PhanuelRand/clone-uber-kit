/**
 * Module 11 : Le paiement par Mobile Money.
 *
 * La course est terminée : le passager paie son prix ferme, celui annoncé à la
 * demande. Une annulation tardive se paie aussi : ses frais du module 10. Tant
 * qu'il doit de l'argent, le passager ne peut pas demander de nouvelle course.
 * Le chauffeur reçoit 80 % du prix, et la plateforme garde le reste.
 *
 * Le prestataire de paiement est simulé : vous l'écrivez vous-même, dans votre
 * API. Il confirme les paiements et signe ses webhooks comme le ferait un vrai
 * prestataire de Mobile Money. Aucun compte chez un prestataire n'est
 * nécessaire, et aucune carte bancaire.
 *
 * Contrat attendu, exporté par `src/academie/module-11.ts` :
 *
 *   export function createAccount(input?: { ...ceux du module 6 }): Promise<string>
 *   export function requestRide(input: { ...ceux du module 9 })
 *   export function createRequestedRide(input?: { ...ceux du module 10 })
 *   export function createDriver(input?: { ...ceux du module 7 })
 *   export function acceptRide, cancelRide        // module 10
 *
 *   export function createCompletedRide(input?: {
 *     riderId?: string             // par défaut un passager neuf
 *     driverId?: string            // par défaut un chauffeur neuf
 *   }): Promise<{ rideId: string; riderId: string; driverId: string; fare: number }>
 *                                  // une course demandée, acceptée, commencée et terminée
 *
 *   export function amountDue(rideId: string): Promise<number>
 *                                  // le prix d'une course terminée, ou les frais d'une annulation,
 *                                  // tant qu'ils ne sont pas payés; 0 sinon
 *
 *   export function payRide(input: {
 *     rideId: string; riderId: string
 *     amount: number; idempotencyKey: string
 *   }): Promise<{
 *     status: number               // 201, ou 200 pour une clé déjà vue;
 *                                  // 400 si le montant n'est pas le montant dû;
 *                                  // 403 si ce n'est pas le passager;
 *                                  // 409 s'il n'y a rien à payer
 *     chargeId?: string
 *   }>
 *
 *   export function listCharges(rideId: string): Promise<{ chargeId: string; amount: number }[]>
 *
 *   export function driverEarnings(driverId: string): Promise<{ rides: number; total: number }>
 *                                  // les courses payées, et 80 % de chaque montant payé,
 *                                  // arrondis à l'ariary inférieur
 *
 *   export function signWebhook(payload: string): string
 *   export function handleWebhook(input: { payload: string; signature: string }): Promise<{ status: number }>
 *
 * `signWebhook` n'existe que pour permettre à cette suite de fabriquer une
 * signature valide. Votre serveur, lui, vérifie celle du prestataire.
 *
 * Un événement porte `{ id, type, rideId, riderId, amount, idempotencyKey,
 * paidAt }`. Un événement `payment.succeeded` correctement signé enregistre le
 * débit sous sa clé d'idempotence, exactement comme `payRide`. Un débit déjà
 * enregistré sous cette clé ne se dédouble pas.
 */
import { describe, expect, it } from 'vitest'
import {
  acceptRide,
  amountDue,
  cancelRide,
  createAccount,
  createCompletedRide,
  createDriver,
  createRequestedRide,
  driverEarnings,
  handleWebhook,
  listCharges,
  payRide,
  requestRide,
  signWebhook,
} from '../../../src/academie/module-11'
import { TANA, inMinutes, north, somewhere } from '../_support/positions'

function pay(rideId: string, riderId: string, amount: number, key = `${rideId}-1`) {
  return payRide({ rideId, riderId, amount, idempotencyKey: key })
}

/** Une nouvelle demande du même passager, pour voir s'il est bloqué. */
function requestAgain(riderId: string) {
  return requestRide({
    riderId,
    pickup: TANA,
    dropoff: north(3),
    pickupLabel: 'Antaninarenina',
    dropoffLabel: 'Ambohijatovo',
    category: 'moto',
    now: inMinutes(0),
    idempotencyKey: `nouvelle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  })
}

/** Une course annulée par le passager six minutes après l'acceptation : 2 000 Ar de frais. */
async function lateCancellation() {
  const pickup = somewhere()
  const ride = await createRequestedRide({ pickup })
  const { driverId } = await createDriver({ position: pickup })
  await acceptRide({ rideId: ride.rideId, driverId, now: inMinutes(0) })
  const cancelled = await cancelRide({ rideId: ride.rideId, memberId: ride.riderId, now: inMinutes(6) })
  if (cancelled.fee !== 2_000) throw new Error(`frais d’annulation inattendus : ${cancelled.fee}`)
  return ride
}

describe('l’encaissement', () => {
  it('débite une fois le prix ferme de la course', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    expect(await amountDue(rideId)).toBe(fare)

    const charge = await pay(rideId, riderId, fare)
    expect(charge.status).toBe(201)
    expect(charge.chargeId, 'un débit porte un identifiant').toBeTruthy()
    expect(await listCharges(rideId)).toEqual([{ chargeId: charge.chargeId, amount: fare }])
    expect(await amountDue(rideId), 'plus rien à payer').toBe(0)
  })

  // Un appel réseau qui échoue ne veut pas dire que rien ne s'est passé.
  it('ne double pas le débit quand la même clé est rejouée', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    const first = await pay(rideId, riderId, fare)
    const replay = await pay(rideId, riderId, fare)

    expect(replay.status).toBe(200)
    expect(replay.chargeId).toBe(first.chargeId)
    expect(await listCharges(rideId)).toHaveLength(1)
  })

  it('ne double pas le débit sous appels simultanés', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    await Promise.all(Array.from({ length: 4 }, () => pay(rideId, riderId, fare)))
    expect(await listCharges(rideId)).toHaveLength(1)
  })

  it('refuse de faire payer deux fois la même course sous une autre clé, avec 409', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    await pay(rideId, riderId, fare)
    expect((await pay(rideId, riderId, fare, `${rideId}-2`)).status).toBe(409)
    expect(await listCharges(rideId)).toHaveLength(1)
  })

  // Le montant vient de la course, pas du navigateur.
  it('refuse un montant qui n’est pas le montant dû, avec 400', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    expect((await pay(rideId, riderId, fare - 1_000)).status).toBe(400)
    expect(await listCharges(rideId)).toEqual([])
    expect(await amountDue(rideId)).toBe(fare)
  })

  it('refuse de payer la course d’un autre, avec 403', async () => {
    const { rideId, fare } = await createCompletedRide()
    expect((await pay(rideId, await createAccount(), fare)).status).toBe(403)
    expect(await listCharges(rideId)).toEqual([])
  })

  it('refuse de payer une course qui n’est pas terminée, avec 409', async () => {
    const { rideId, riderId, fare } = await createRequestedRide({ pickup: somewhere() })
    expect(await amountDue(rideId)).toBe(0)
    expect((await pay(rideId, riderId, fare)).status).toBe(409)
  })
})

describe('les frais d’annulation', () => {
  it('se paient comme une course, une seule fois', async () => {
    const { rideId, riderId } = await lateCancellation()
    expect(await amountDue(rideId)).toBe(2_000)
    expect((await pay(rideId, riderId, 2_000)).status).toBe(201)
    expect(await amountDue(rideId)).toBe(0)
  })

  it('ne coûtent rien pour une annulation sans frais', async () => {
    const { rideId, riderId, fare } = await createRequestedRide({ pickup: somewhere() })
    await cancelRide({ rideId, memberId: riderId, now: inMinutes(0) })
    expect(await amountDue(rideId)).toBe(0)
    expect((await pay(rideId, riderId, fare)).status).toBe(409)
  })
})

describe('le passager qui doit de l’argent', () => {
  it('ne peut pas demander de nouvelle course avant d’avoir payé la précédente', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    const blocked = await requestAgain(riderId)
    expect(blocked.status).toBe(409)
    expect(blocked.reason, 'le refus doit dire ce qu’il reste à payer').toBeTruthy()

    await pay(rideId, riderId, fare)
    expect((await requestAgain(riderId)).status).toBe(201)
  })

  it('ne peut pas non plus avant d’avoir payé ses frais d’annulation', async () => {
    const { rideId, riderId } = await lateCancellation()
    expect((await requestAgain(riderId)).status).toBe(409)
    await pay(rideId, riderId, 2_000)
    expect((await requestAgain(riderId)).status).toBe(201)
  })
})

describe('ce que gagne le chauffeur', () => {
  it('reçoit 80 % de chaque course payée, arrondis à l’ariary inférieur', async () => {
    const first = await createCompletedRide()
    const second = await createCompletedRide({ driverId: first.driverId })
    const unpaid = await createCompletedRide({ driverId: first.driverId })
    await pay(first.rideId, first.riderId, first.fare)
    await pay(second.rideId, second.riderId, second.fare)

    expect(unpaid.fare).toBeGreaterThan(0)
    expect(await driverEarnings(first.driverId)).toEqual({
      rides: 2,
      total: Math.floor((first.fare * 80) / 100) + Math.floor((second.fare * 80) / 100),
    })
  })

  it('ne gagne rien sur une course impayée', async () => {
    const { driverId } = await createCompletedRide()
    expect(await driverEarnings(driverId)).toEqual({ rides: 0, total: 0 })
  })
})

describe('les webhooks du prestataire', () => {
  function event(id: string, rideId: string, riderId: string, amount: number, key = `${rideId}-1`) {
    return JSON.stringify({
      id,
      type: 'payment.succeeded',
      rideId,
      riderId,
      amount,
      idempotencyKey: key,
      paidAt: new Date().toISOString(),
    })
  }

  it('refuse un événement dont la signature est invalide', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    const response = await handleWebhook({ payload: event(`evt-${rideId}`, rideId, riderId, fare), signature: 'inventee' })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
    expect(await listCharges(rideId)).toEqual([])
    expect(await amountDue(rideId)).toBe(fare)
  })

  it('enregistre le débit pour un événement correctement signé', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    const payload = event(`evt-${rideId}`, rideId, riderId, fare)
    const response = await handleWebhook({ payload, signature: signWebhook(payload) })

    expect(response.status).toBeGreaterThanOrEqual(200)
    expect(response.status).toBeLessThan(300)
    expect(await listCharges(rideId)).toHaveLength(1)
    expect(await amountDue(rideId)).toBe(0)
  })

  // Un prestataire redélivre ses événements : c'est normal, pas une anomalie.
  it('absorbe la redélivrance du même événement sans second effet', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    const payload = event(`evt-${rideId}`, rideId, riderId, fare)
    const signature = signWebhook(payload)
    await handleWebhook({ payload, signature })
    await handleWebhook({ payload, signature })

    expect(await listCharges(rideId)).toHaveLength(1)
  })

  it('ne dédouble pas un paiement déjà encaissé sous la même clé', async () => {
    const { rideId, riderId, fare } = await createCompletedRide()
    await pay(rideId, riderId, fare)
    const payload = event(`evt-${rideId}`, rideId, riderId, fare)
    await handleWebhook({ payload, signature: signWebhook(payload) })

    expect(await listCharges(rideId)).toHaveLength(1)
  })
})
