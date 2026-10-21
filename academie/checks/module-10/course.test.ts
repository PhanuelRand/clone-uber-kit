/**
 * Module 10 : Le chauffeur accepte, vient et conduit.
 *
 * Une demande attend un chauffeur. Les chauffeurs vérifiés des environs la
 * voient, l'un d'eux l'accepte, vient au point de départ, fait monter le
 * passager contre le code de départ à quatre chiffres que le passager lui
 * donne, puis le conduit jusqu'à destination.
 *
 * Contrat attendu, exporté par `src/academie/module-10.ts` :
 *
 *   export function createAccount(input?: { ...ceux du module 6 }): Promise<string>
 *   export function createDriver(input?: { ...ceux du module 7 }): Promise<{ driverId: string }>
 *
 *   export function createRequestedRide(input?: {
 *     riderId?: string                         // par défaut un passager neuf
 *     pickup?: { latitude: number; longitude: number }    // par défaut le centre d'Antananarivo
 *     category?: string                        // par défaut 'voiture'
 *     now?: string                             // par défaut maintenant
 *   }): Promise<{
 *     rideId: string; riderId: string; fare: number
 *     startCode: string                        // quatre chiffres, que seul le passager connaît
 *   }>                                         // une course demandée par requestRide, à 5 km au nord du départ,
 *                                              // de 'Analakely, devant la pharmacie' à
 *                                              // 'Ivandry, entrée du centre commercial',
 *                                              // avec la note 'Je porte un sac rouge.'
 *
 *   export function availableRides(input: {
 *     driverId: string
 *     near: { latitude: number; longitude: number }   // la position du chauffeur
 *     now: string
 *   }): Promise<{
 *     status: number                           // 200, ou 403 si ce n'est pas un chauffeur vérifié
 *     items: { rideId: string; category: string; pickupDistanceKm: number; tripDistanceKm: number; fare: number }[]
 *   }>
 *
 *   export function acceptRide(input: { rideId: string; driverId: string; now: string }):
 *     Promise<{ status: number; reason?: string }>   // 200; 403; 404; 409 déjà prise, expirée, ou chauffeur occupé
 *   export function assignedDriver(rideId: string): Promise<string | null>
 *   export function rideStatus(rideId: string): Promise<string>
 *
 *   export function riderView(input: { rideId: string; riderId: string }): Promise<{
 *     status: number                           // 200 pour le passager de la course, 403 sinon
 *     view?: {
 *       status: string; startCode: string
 *       driver: null | { firstName: string; vehicle: { make: string; color: string; plate: string } }
 *     }
 *   }>
 *
 *   export function driverView(input: { rideId: string; driverId: string }): Promise<{
 *     status: number                           // 200 pour le chauffeur de la course, 403 sinon
 *     view?: {
 *       status: string
 *       pickupLabel: string; note: string | null
 *       dropoffLabel: string | null            // null tant que la course n'a pas commencé
 *     }
 *   }>
 *
 *   export function arrive(input: { rideId: string; driverId: string }): Promise<{ status: number }>
 *   export function startRide(input: { rideId: string; driverId: string; code: string }): Promise<{ status: number }>
 *   export function completeRide(input: { rideId: string; driverId: string; now: string }): Promise<{ status: number }>
 *                                              // 200; 400 pour un mauvais code; 403; 409 si le passage est interdit
 *
 *   export function cancelRide(input: { rideId: string; memberId: string; now: string }):
 *     Promise<{ status: number; fee?: number }>   // 200 et les frais; 403 pour un autre compte; 409 trop tard
 *
 * Les règles :
 *   - un chauffeur vérifié voit les demandes de la catégorie de son véhicule,
 *     faites il y a moins de cinq minutes, dont le départ est à 3 km de lui au
 *     plus, les plus proches d'abord, avec la distance jusqu'au départ et la
 *     longueur du trajet, en kilomètres arrondis au dixième; il ne voit rien du
 *     passager, ni son nom, ni l'adresse de départ, ni la destination;
 *   - une course n'est acceptée qu'une fois, et un chauffeur ne conduit qu'une
 *     course à la fois : acceptée, chauffeur arrivé ou commencée;
 *   - le passager voit le prénom du chauffeur et son véhicule dès l'acceptation,
 *     et son code de départ; le chauffeur ne voit jamais ce code;
 *   - le chauffeur voit l'adresse de départ et la note dès l'acceptation, et la
 *     destination une fois la course commencée;
 *   - le passager annule tant qu'il n'est pas monté; il paie 2 000 Ar de frais
 *     quand il annule après l'arrivée du chauffeur, ou plus de cinq minutes après
 *     l'acceptation. Le chauffeur de la course peut aussi annuler, sans frais
 *     pour le passager.
 */
import { describe, expect, it } from 'vitest'
import {
  acceptRide,
  arrive,
  assignedDriver,
  availableRides,
  cancelRide,
  completeRide,
  createAccount,
  createDriver,
  createRequestedRide,
  driverView,
  rideStatus,
  riderView,
  startRide,
} from '../../../src/academie/module-10'
import { inMinutes, north, somewhere } from '../_support/positions'

const now = () => new Date().toISOString()

/** Un chauffeur vérifié, en ligne, avec une voiture, dans un coin de l'île où personne d'autre n'essaie. */
async function driverNear(spot: { latitude: number; longitude: number }, category = 'voiture') {
  return (await createDriver({ position: spot, category })).driverId
}

/** Une demande, et un chauffeur à 1 km de son départ. */
async function waiting(category = 'voiture') {
  const pickup = somewhere()
  const ride = await createRequestedRide({ pickup, category })
  const driverId = await driverNear(north(1, pickup), category)
  return { ...ride, pickup, driverId }
}

async function accepted() {
  const ride = await waiting()
  const result = await acceptRide({ rideId: ride.rideId, driverId: ride.driverId, now: now() })
  if (result.status !== 200) throw new Error(`acceptation refusée : ${result.reason ?? result.status}`)
  return ride
}

async function started() {
  const ride = await accepted()
  await arrive({ rideId: ride.rideId, driverId: ride.driverId })
  await startRide({ rideId: ride.rideId, driverId: ride.driverId, code: ride.startCode })
  return ride
}

describe('les demandes proposées aux chauffeurs', () => {
  it('montre à un chauffeur vérifié les demandes proches, sans rien du passager', async () => {
    const { rideId, pickup, driverId, fare } = await waiting()
    const offers = await availableRides({ driverId, near: north(1, pickup), now: now() })

    expect(offers.status).toBe(200)
    const item = offers.items.find((entry) => entry.rideId === rideId)
    expect(item, 'une demande à 1 km doit être proposée').toBeDefined()
    expect(item).toMatchObject({ category: 'voiture', pickupDistanceKm: 1, tripDistanceKm: 6.5, fare })
    expect(JSON.stringify(offers), 'ni adresse, ni destination, ni passager avant l’acceptation').not.toMatch(
      /Analakely|pharmacie|Ivandry|label|adresse|address|note|rider|passager|name|nom|phone|email/i,
    )
  })

  it('ne propose ni une demande trop loin, ni une autre catégorie, ni une demande expirée', async () => {
    const far = await waiting()
    const fromFar = await availableRides({ driverId: far.driverId, near: north(4, far.pickup), now: now() })
    expect(fromFar.items.map((item) => item.rideId), 'une demande à 4 km').not.toContain(far.rideId)

    const moto = await waiting('moto')
    const carDriver = await driverNear(north(1, moto.pickup), 'voiture')
    const forCar = await availableRides({ driverId: carDriver, near: north(1, moto.pickup), now: now() })
    expect(forCar.items.map((item) => item.rideId), 'une demande de moto pour une voiture').not.toContain(moto.rideId)

    const pickup = somewhere()
    const old = await createRequestedRide({ pickup, now: inMinutes(-6) })
    const driverId = await driverNear(pickup)
    const late = await availableRides({ driverId, near: pickup, now: now() })
    expect(late.items.map((item) => item.rideId), 'une demande de six minutes').not.toContain(old.rideId)
  })

  it('range les demandes de la plus proche à la plus loin', async () => {
    const spot = somewhere()
    const farther = await createRequestedRide({ pickup: north(2, spot) })
    const closer = await createRequestedRide({ pickup: north(0.5, spot) })
    const driverId = await driverNear(spot)

    const ids = (await availableRides({ driverId, near: spot, now: now() })).items.map((item) => item.rideId)
    expect(ids.indexOf(closer.rideId), 'la plus proche d’abord').toBeLessThan(ids.indexOf(farther.rideId))
  })

  it('refuse les demandes à un chauffeur en attente de vérification, ou à un passager, avec 403', async () => {
    const pending = await createAccount({ roles: ['RIDER', 'DRIVER'], driverStatus: 'PENDING' })
    const rider = await createAccount()
    for (const driverId of [pending, rider]) {
      const offers = await availableRides({ driverId, near: somewhere(), now: now() })
      expect(offers.status).toBe(403)
      expect(offers.items).toEqual([])
      const { rideId } = await createRequestedRide({ pickup: somewhere() })
      expect((await acceptRide({ rideId, driverId, now: now() })).status).toBe(403)
    }
  })
})

describe('accepter une course', () => {
  it('confie la course à un seul chauffeur, et retire l’offre aux autres', async () => {
    const { rideId, pickup, driverId } = await waiting()
    const second = await driverNear(pickup)

    expect((await acceptRide({ rideId, driverId, now: now() })).status).toBe(200)
    expect(await rideStatus(rideId)).toBe('ACCEPTED')
    expect(await assignedDriver(rideId)).toBe(driverId)
    expect((await acceptRide({ rideId, driverId: second, now: now() })).status, 'déjà prise').toBe(409)

    const offers = await availableRides({ driverId: second, near: pickup, now: now() })
    expect(offers.items.map((item) => item.rideId)).not.toContain(rideId)
  })

  it('refuse une seconde course à un chauffeur déjà occupé, avec 409 et un motif', async () => {
    const { driverId, pickup } = await accepted()
    const { rideId } = await createRequestedRide({ pickup })

    const second = await acceptRide({ rideId, driverId, now: now() })
    expect(second.status).toBe(409)
    expect(second.reason, 'le refus doit porter un motif lisible').toBeTruthy()
    expect(await assignedDriver(rideId)).toBeNull()
  })

  it('refuse une demande expirée, et une course inconnue', async () => {
    const pickup = somewhere()
    const { rideId } = await createRequestedRide({ pickup, now: inMinutes(-6) })
    const driverId = await driverNear(pickup)
    expect((await acceptRide({ rideId, driverId, now: now() })).status).toBe(409)
    expect((await acceptRide({ rideId: '00000000-0000-4000-8000-000000000000', driverId, now: now() })).status).toBe(404)
  })

  it('refuse une demande d’une autre catégorie que son véhicule, avec 409', async () => {
    const { rideId, pickup } = await waiting('familiale')
    const motoDriver = await driverNear(pickup, 'moto')
    expect((await acceptRide({ rideId, driverId: motoDriver, now: now() })).status).toBe(409)
  })
})

describe('ce que chacun voit', () => {
  it('montre au passager le chauffeur, son véhicule et le code de départ', async () => {
    const { rideId, riderId, startCode } = await waiting()
    const before = await riderView({ rideId, riderId })
    expect(before.view).toMatchObject({ status: 'REQUESTED', startCode, driver: null })

    const { driverId } = await waitingDriverAccepts(rideId)
    const after = await riderView({ rideId, riderId })
    expect(after.view?.status).toBe('ACCEPTED')
    expect(after.view?.driver?.firstName, 'le prénom du chauffeur').toBeTruthy()
    expect(after.view?.driver?.vehicle.plate, 'la plaque, pour reconnaître la voiture').toMatch(/^\d{4} [A-Z]{2,3}$/)
    expect(JSON.stringify(after), 'rien du compte du chauffeur').not.toContain(driverId)
  })

  it('montre au chauffeur le départ et la note, puis la destination une fois la course commencée', async () => {
    const { rideId, driverId, startCode } = await accepted()
    const atPickup = await driverView({ rideId, driverId })
    expect(atPickup.status).toBe(200)
    expect(atPickup.view).toMatchObject({ pickupLabel: 'Analakely, devant la pharmacie', note: 'Je porte un sac rouge.', dropoffLabel: null })
    expect(JSON.stringify(atPickup), 'le code de départ, le chauffeur le demande au passager').not.toContain(startCode)

    await arrive({ rideId, driverId })
    await startRide({ rideId, driverId, code: startCode })
    expect((await driverView({ rideId, driverId })).view?.dropoffLabel).toBe('Ivandry, entrée du centre commercial')
  })

  it('refuse la course à un autre chauffeur et à un tiers, avec 403', async () => {
    const { rideId, pickup } = await accepted()
    const other = await driverNear(pickup)
    expect((await driverView({ rideId, driverId: other })).status).toBe(403)
    expect((await driverView({ rideId, driverId: other })).view).toBeUndefined()
    expect((await riderView({ rideId, riderId: await createAccount() })).status).toBe(403)
  })
})

/** Un chauffeur neuf, à côté du départ, accepte la course. */
async function waitingDriverAccepts(rideId: string) {
  const driverId = (await createDriver({ position: somewhere() })).driverId
  const result = await acceptRide({ rideId, driverId, now: now() })
  if (result.status !== 200) throw new Error(`acceptation refusée : ${result.reason ?? result.status}`)
  return { driverId }
}

describe('venir, démarrer, arriver', () => {
  it('démarre la course contre le bon code, et seulement une fois le chauffeur arrivé', async () => {
    const { rideId, driverId, startCode } = await accepted()
    expect((await startRide({ rideId, driverId, code: startCode })).status, 'pas encore arrivé').toBe(409)

    expect((await arrive({ rideId, driverId })).status).toBe(200)
    expect(await rideStatus(rideId)).toBe('ARRIVED')

    const wrong = startCode === '0000' ? '1111' : '0000'
    expect((await startRide({ rideId, driverId, code: wrong })).status).toBe(400)
    expect(await rideStatus(rideId), 'un mauvais code ne démarre rien').toBe('ARRIVED')

    expect((await startRide({ rideId, driverId, code: startCode })).status).toBe(200)
    expect(await rideStatus(rideId)).toBe('IN_PROGRESS')
  })

  it('refuse à un autre chauffeur d’arriver, de démarrer ou de terminer, avec 403', async () => {
    const { rideId, pickup, startCode } = await accepted()
    const other = await driverNear(pickup)
    expect((await arrive({ rideId, driverId: other })).status).toBe(403)
    expect((await startRide({ rideId, driverId: other, code: startCode })).status).toBe(403)
    expect((await completeRide({ rideId, driverId: other, now: now() })).status).toBe(403)
    expect(await rideStatus(rideId)).toBe('ACCEPTED')
  })

  it('termine la course, et libère le chauffeur', async () => {
    const { rideId, driverId, pickup } = await started()
    expect((await completeRide({ rideId, driverId, now: now() })).status).toBe(200)
    expect(await rideStatus(rideId)).toBe('COMPLETED')
    expect((await completeRide({ rideId, driverId, now: now() })).status, 'une seconde fois').toBe(409)

    const next = await createRequestedRide({ pickup })
    expect((await acceptRide({ rideId: next.rideId, driverId, now: now() })).status, 'une course terminée ne l’occupe plus').toBe(200)
  })
})

describe('annuler', () => {
  it('annule une demande sans frais', async () => {
    const { rideId, riderId } = await createRequestedRide({ pickup: somewhere() })
    expect(await cancelRide({ rideId, memberId: riderId, now: now() })).toMatchObject({ status: 200, fee: 0 })
    expect(await rideStatus(rideId)).toBe('CANCELLED')
  })

  it('annule sans frais dans les cinq minutes qui suivent l’acceptation', async () => {
    const { rideId, riderId } = await accepted()
    expect(await cancelRide({ rideId, memberId: riderId, now: inMinutes(4) })).toMatchObject({ status: 200, fee: 0 })
  })

  it('compte 2 000 Ar de frais après cinq minutes, ou une fois le chauffeur arrivé', async () => {
    const late = await accepted()
    expect(await cancelRide({ rideId: late.rideId, memberId: late.riderId, now: inMinutes(6) })).toMatchObject({ status: 200, fee: 2_000 })

    const arrived = await accepted()
    await arrive({ rideId: arrived.rideId, driverId: arrived.driverId })
    expect(await cancelRide({ rideId: arrived.rideId, memberId: arrived.riderId, now: now() })).toMatchObject({ status: 200, fee: 2_000 })
  })

  it('laisse le chauffeur annuler sans frais pour le passager, et le libère', async () => {
    const { rideId, driverId, pickup } = await accepted()
    expect(await cancelRide({ rideId, memberId: driverId, now: inMinutes(10) })).toMatchObject({ status: 200, fee: 0 })

    const next = await createRequestedRide({ pickup })
    expect((await acceptRide({ rideId: next.rideId, driverId, now: now() })).status).toBe(200)
  })

  it('refuse d’annuler une course commencée avec 409, et la course d’un autre avec 403', async () => {
    const { rideId, riderId } = await started()
    expect((await cancelRide({ rideId, memberId: riderId, now: now() })).status).toBe(409)
    expect((await cancelRide({ rideId, memberId: await createAccount(), now: now() })).status).toBe(403)
    expect(await rideStatus(rideId)).toBe('IN_PROGRESS')
  })
})
