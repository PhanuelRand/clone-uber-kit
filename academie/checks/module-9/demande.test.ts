/**
 * Module 9 : La demande de course.
 *
 * Le passager a vu les prix; il choisit une catégorie et demande la course. Le
 * serveur recalcule le prix : il ne croit jamais un prix envoyé par le
 * navigateur. La course garde ce prix, qui ne bougera plus : c'est un prix
 * ferme, celui que le passager a accepté.
 *
 * Contrat attendu, exporté par `src/academie/module-9.ts` :
 *
 *   export function createAccount(input?: { ...ceux du module 6 }): Promise<string>
 *
 *   export function requestRide(input: {
 *     riderId: string
 *     pickup: { latitude: number; longitude: number }
 *     dropoff: { latitude: number; longitude: number }
 *     pickupLabel: string            // l'adresse lisible : « Analakely, devant la pharmacie »
 *     dropoffLabel: string
 *     category: string               // 'moto', 'voiture' ou 'familiale'
 *     note?: string                  // pour le chauffeur, 200 caractères au plus
 *     now: string                    // un instant ISO 8601
 *     idempotencyKey: string         // choisie par l'interface, une par appui sur « Commander »
 *   }): Promise<{
 *     status: number                 // 201; 200 pour une clé déjà vue; 400, 403 ou 409
 *     rideId?: string; fare?: number; reason?: string
 *   }>
 *
 *   export function getRide(input: { rideId: string; viewerId: string }): Promise<{
 *     status: number                 // 200, ou 403 pour un autre compte que le passager
 *     ride?: {
 *       rideId: string; status: string; category: string
 *       fare: number; distanceMeters: number; durationSeconds: number
 *       pickupLabel: string; dropoffLabel: string
 *     }
 *   }>
 *
 *   export function ridesOf(riderId: string): Promise<{ rideId: string; status: string; fare: number }[]>
 *                                    // les plus récentes d'abord
 *
 * Le prix suit les règles du module 8, à l'instant `now`. La demande est
 * refusée :
 *   - avec 400 : pour une catégorie inconnue, une adresse lisible vide, une
 *     note de plus de 200 caractères, ou un trajet que l'estimation refuse;
 *   - avec 403 : pour un compte qui n'a pas le rôle RIDER;
 *   - avec 409 : quand le passager a déjà une course en cours, demandée,
 *     acceptée, chauffeur arrivé ou commencée.
 *
 * Une demande que personne n'accepte expire cinq minutes après avoir été
 * faite : elle passe à EXPIRED, et ne compte plus comme course en cours.
 *
 * La même clé d'idempotence, rejouée avec la même demande, rend la même course
 * avec 200 : un double appui ne demande pas deux courses. Rejouée avec une
 * autre demande, elle est refusée avec 409.
 */
import { describe, expect, it } from 'vitest'
import { createAccount, getRide, requestRide, ridesOf } from '../../../src/academie/module-9'
import { TANA, inMadagascar, inMinutes, north } from '../_support/positions'

function key() {
  return `demande-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function demand(riderId: string, overrides: Partial<Parameters<typeof requestRide>[0]> = {}) {
  return {
    riderId,
    pickup: TANA,
    dropoff: north(5),
    pickupLabel: 'Analakely, devant la pharmacie',
    dropoffLabel: 'Ivandry, entrée du centre commercial',
    category: 'voiture',
    note: 'Je porte un sac rouge.',
    now: inMinutes(0),
    idempotencyKey: key(),
    ...overrides,
  }
}

describe('demander une course', () => {
  it('crée une course demandée, au prix de l’estimation', async () => {
    const riderId = await createAccount()
    const result = await requestRide(demand(riderId, { now: inMadagascar('2030-07-15', '12:00') }))
    expect(result.status).toBe(201)
    expect(result.fare).toBe(9_800)

    const read = await getRide({ rideId: result.rideId ?? '', viewerId: riderId })
    expect(read.status).toBe(200)
    expect(read.ride).toMatchObject({
      rideId: result.rideId,
      status: 'REQUESTED',
      category: 'voiture',
      fare: 9_800,
      distanceMeters: 6_500,
      durationSeconds: 1_170,
      pickupLabel: 'Analakely, devant la pharmacie',
      dropoffLabel: 'Ivandry, entrée du centre commercial',
    })
  })

  it('calcule le prix de la catégorie choisie, et le tarif de nuit', async () => {
    const moto = await requestRide(demand(await createAccount(), { category: 'moto', now: inMadagascar('2030-07-15', '12:00') }))
    expect(moto.fare).toBe(4_400)
    const night = await requestRide(demand(await createAccount(), { now: inMadagascar('2030-07-15', '23:00') }))
    expect(night.fare).toBe(11_800)
  })

  // Le prix vient du serveur, pas du navigateur.
  it('ignore un prix envoyé avec la demande', async () => {
    const riderId = await createAccount()
    const result = await requestRide({ ...demand(riderId, { now: inMadagascar('2030-07-15', '12:00') }), fare: 100 } as never)
    expect(result.fare).toBe(9_800)
  })

  it('refuse une catégorie inconnue, une adresse vide, une note trop longue ou un trajet refusé, avec 400', async () => {
    const riderId = await createAccount()
    const cases = [
      { category: 'helicoptere' },
      { pickupLabel: '  ' },
      { dropoffLabel: '' },
      { note: 'a'.repeat(201) },
      { dropoff: north(0.1) },
      { dropoff: north(45) },
    ]
    for (const overrides of cases) {
      const result = await requestRide(demand(riderId, overrides))
      expect(result.status, JSON.stringify(overrides)).toBe(400)
      expect(result.reason, 'le refus doit porter un motif lisible').toBeTruthy()
    }
    expect(await ridesOf(riderId), 'un refus ne crée rien').toEqual([])
  })

  it('refuse un compte qui n’a pas le rôle de passager, avec 403', async () => {
    const driverOnly = await createAccount({ roles: ['DRIVER'], driverStatus: 'APPROVED' })
    expect((await requestRide(demand(driverOnly))).status).toBe(403)
  })

  it('refuse à un autre compte de lire la course, avec 403', async () => {
    const riderId = await createAccount()
    const { rideId = '' } = await requestRide(demand(riderId))
    const read = await getRide({ rideId, viewerId: await createAccount() })
    expect(read.status).toBe(403)
    expect(read.ride, 'un tiers ne voit rien de la course').toBeUndefined()
  })

  it('range la course dans « Mes courses », les plus récentes d’abord', async () => {
    const riderId = await createAccount()
    const first = await requestRide(demand(riderId, { now: inMinutes(-30) }))
    const second = await requestRide(demand(riderId, { now: inMinutes(0) }))
    expect((await ridesOf(riderId)).map((ride) => ride.rideId)).toEqual([second.rideId, first.rideId])
  })
})

describe('une course à la fois', () => {
  it('refuse une seconde demande pendant que la première attend un chauffeur, avec 409 et un motif', async () => {
    const riderId = await createAccount()
    await requestRide(demand(riderId))
    const second = await requestRide(demand(riderId))
    expect(second.status).toBe(409)
    expect(second.reason).toBeTruthy()
    expect(await ridesOf(riderId)).toHaveLength(1)
  })

  // Personne n'a accepté en cinq minutes : le passager doit pouvoir réessayer.
  it('laisse expirer une demande sans chauffeur après cinq minutes', async () => {
    const riderId = await createAccount()
    const old = await requestRide(demand(riderId, { now: inMinutes(-6) }))
    const fresh = await requestRide(demand(riderId, { now: inMinutes(0) }))

    expect(fresh.status, 'la première demande a expiré').toBe(201)
    expect((await getRide({ rideId: old.rideId ?? '', viewerId: riderId })).ride?.status).toBe('EXPIRED')
  })

  it('garde une demande de moins de cinq minutes', async () => {
    const riderId = await createAccount()
    await requestRide(demand(riderId, { now: inMinutes(-4) }))
    expect((await requestRide(demand(riderId, { now: inMinutes(0) }))).status).toBe(409)
  })
})

describe('la clé d’idempotence', () => {
  it('rend la même course quand la même demande est rejouée', async () => {
    const riderId = await createAccount()
    const input = demand(riderId)
    const first = await requestRide(input)
    const replay = await requestRide(input)

    expect(first.status).toBe(201)
    expect(replay.status, 'un double appui n’est pas une seconde demande').toBe(200)
    expect(replay.rideId).toBe(first.rideId)
    expect(await ridesOf(riderId)).toHaveLength(1)
  })

  it('refuse la même clé pour une autre demande, avec 409', async () => {
    const riderId = await createAccount()
    const input = demand(riderId)
    await requestRide(input)

    const other = await requestRide({ ...input, category: 'moto' })
    expect(other.status).toBe(409)
    expect(other.reason).toBeTruthy()
    expect(await ridesOf(riderId)).toHaveLength(1)
  })
})
