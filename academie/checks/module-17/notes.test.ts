/**
 * Module 17 : Les notes. Module Platine.
 *
 * Après une course, le passager note le chauffeur, et le chauffeur note le
 * passager, de 1 à 5, avec un commentaire s'ils le souhaitent. Chacun voit sa
 * propre note, et le passager voit celle du chauffeur qui vient le chercher.
 *
 * Trois règles font une note qui veut dire quelque chose :
 *
 * - elle ne s'affiche qu'à partir de cinq notes : une seule mauvaise course, ou
 *   un seul ami complaisant, ne la décide pas;
 * - elle porte sur les vingt dernières notes reçues : un chauffeur qui a
 *   progressé n'est pas jugé sur ses débuts;
 * - un chauffeur dont la moyenne passe sous 4,0, avec au moins dix notes, est
 *   signalé à l'équipe pour un entretien.
 *
 * Contrat attendu, exporté par `src/academie/module-17.ts` :
 *
 *   export function createAccount(input?: { ...ceux du module 6 }): Promise<string>
 *   export function createDriver(input?: { ...ceux du module 7 })
 *   export function createRequestedRide(input?: { ...ceux du module 10 })
 *
 *   export function createCompletedRide(input?: {
 *     riderId?: string             // par défaut un passager neuf
 *     driverId?: string            // par défaut un chauffeur neuf
 *     completedAt?: string         // un instant ISO 8601; par défaut maintenant
 *   }): Promise<{ rideId: string; riderId: string; driverId: string; fare: number }>
 *                                  // une course demandée, acceptée, commencée, terminée à completedAt,
 *                                  // puis payée : le même passager peut en demander une autre
 *
 *   export function rateRide(input: {
 *     rideId: string; authorId: string
 *     rating: number               // un entier de 1 à 5
 *     comment?: string             // 300 caractères au plus
 *     now: string                  // un instant ISO 8601
 *   }): Promise<{ status: number }>
 *                                  // 201; 400 pour une note invalide ou un commentaire trop long;
 *                                  // 403 si l'auteur n'est ni le passager ni le chauffeur, ou si la course
 *                                  // n'est pas terminée; 409 pour une seconde note du même auteur;
 *                                  // 410 plus de sept jours après la fin de la course
 *
 *   export function driverRating(driverId: string): Promise<{
 *     average: number | null       // à deux chiffres après la virgule; null sous cinq notes
 *     count: number                // toutes les notes reçues
 *     underReview: boolean         // moyenne sous 4,0 avec au moins dix notes
 *   }>
 *
 *   export function riderRating(riderId: string): Promise<{ average: number | null; count: number }>
 *
 *   export function driverFeedback(driverId: string): Promise<{ rating: number; comment: string }[]>
 *                                  // les commentaires reçus, les plus récents d'abord
 *
 * La moyenne porte sur les vingt dernières notes, dans l'ordre où elles ont été
 * données (`now`). Un commentaire ne dit jamais qui l'a écrit : ni son nom, ni
 * son identifiant, ni la course.
 */
import { describe, expect, it } from 'vitest'
import {
  createAccount,
  createCompletedRide,
  createDriver,
  createRequestedRide,
  driverFeedback,
  driverRating,
  rateRide,
  riderRating,
} from '../../../src/academie/module-17'
import { somewhere } from '../_support/positions'

const completedAt = '2030-07-15T09:30:00.000Z'

/** Le lendemain de la course, `minutes` minutes après 9 h 30 UTC : pour ordonner les notes. */
function nextDay(minutes = 0) {
  return new Date(Date.UTC(2030, 6, 16, 9, 30 + minutes)).toISOString()
}

/** Un chauffeur neuf, qui a terminé autant de courses qu'il y a de notes, notées dans l'ordre. */
async function ratedDriver(ratings: number[]) {
  const { driverId } = await createDriver({ position: somewhere() })
  for (const [index, rating] of ratings.entries()) {
    const ride = await createCompletedRide({ driverId, completedAt })
    const result = await rateRide({ rideId: ride.rideId, authorId: ride.riderId, rating, now: nextDay(index) })
    if (result.status !== 201) throw new Error(`note refusée : ${result.status}`)
  }
  return driverId
}

describe('noter une course', () => {
  it('laisse le passager et le chauffeur se noter, une fois chacun', async () => {
    const { rideId, riderId, driverId } = await createCompletedRide({ completedAt })
    expect((await rateRide({ rideId, authorId: riderId, rating: 5, comment: 'Conduite calme.', now: nextDay() })).status).toBe(201)
    expect((await rateRide({ rideId, authorId: driverId, rating: 4, now: nextDay() })).status).toBe(201)

    expect((await rateRide({ rideId, authorId: riderId, rating: 1, now: nextDay() })).status, 'une seconde note').toBe(409)
    expect((await rateRide({ rideId, authorId: driverId, rating: 1, now: nextDay() })).status).toBe(409)
  })

  it('refuse une note hors de 1 à 5 ou à virgule, ou un commentaire trop long, avec 400', async () => {
    const { rideId, riderId } = await createCompletedRide({ completedAt })
    for (const rating of [0, 6, 3.5]) {
      expect((await rateRide({ rideId, authorId: riderId, rating, now: nextDay() })).status, `note ${rating}`).toBe(400)
    }
    expect((await rateRide({ rideId, authorId: riderId, rating: 4, comment: 'a'.repeat(301), now: nextDay() })).status).toBe(400)
  })

  it('refuse la note d’un tiers, avec 403', async () => {
    const { rideId } = await createCompletedRide({ completedAt })
    expect((await rateRide({ rideId, authorId: await createAccount(), rating: 5, now: nextDay() })).status).toBe(403)
  })

  it('refuse une note sur une course qui n’est pas terminée, avec 403', async () => {
    const { rideId, riderId } = await createRequestedRide({ pickup: somewhere() })
    expect((await rateRide({ rideId, authorId: riderId, rating: 5, now: new Date().toISOString() })).status).toBe(403)
  })

  it('accepte une note jusqu’à sept jours après la course, et la refuse ensuite avec 410', async () => {
    const late = await createCompletedRide({ completedAt })
    expect((await rateRide({ rideId: late.rideId, authorId: late.riderId, rating: 4, now: '2030-07-22T09:31:00.000Z' })).status).toBe(410)

    const onTime = await createCompletedRide({ completedAt })
    expect((await rateRide({ rideId: onTime.rideId, authorId: onTime.riderId, rating: 4, now: '2030-07-22T09:30:00.000Z' })).status).toBe(201)
  })
})

describe('la note d’un chauffeur', { timeout: 120_000 }, () => {
  it('reste cachée sous cinq notes, mais compte les notes', async () => {
    const driverId = await ratedDriver([5, 5, 4, 5])
    expect(await driverRating(driverId)).toEqual({ average: null, count: 4, underReview: false })
  })

  it('fait la moyenne à partir de cinq notes, à deux chiffres après la virgule', async () => {
    const driverId = await ratedDriver([5, 4, 4, 5, 5, 4])
    expect(await driverRating(driverId)).toEqual({ average: 4.5, count: 6, underReview: false })
  })

  // 30 ÷ 7 = 4,2857…
  it('arrondit la moyenne au centième', async () => {
    const driverId = await ratedDriver([5, 4, 4, 5, 5, 4, 3])
    expect((await driverRating(driverId)).average).toBe(4.29)
  })

  // Deux mauvaises notes au début, puis vingt bonnes : seules les vingt dernières comptent.
  it('ne compte que les vingt dernières notes', async () => {
    const driverId = await ratedDriver([1, 1, ...Array.from({ length: 20 }, () => 5)])
    expect(await driverRating(driverId)).toEqual({ average: 5, count: 22, underReview: false })
  })

  it('signale un chauffeur sous 4,0 avec au moins dix notes', async () => {
    const tenThrees = await ratedDriver(Array.from({ length: 10 }, () => 3))
    expect(await driverRating(tenThrees)).toEqual({ average: 3, count: 10, underReview: true })

    const nineOnes = await ratedDriver(Array.from({ length: 9 }, () => 1))
    expect((await driverRating(nineOnes)).underReview, 'neuf notes ne suffisent pas').toBe(false)
  })
})

describe('la note d’un passager', { timeout: 60_000 }, () => {
  it('se calcule sur les notes données par les chauffeurs, à partir de cinq', async () => {
    const riderId = await createAccount()
    const ratings = [5, 4, 5, 5, 3]
    for (const [index, rating] of ratings.entries()) {
      const ride = await createCompletedRide({ riderId, completedAt })
      await rateRide({ rideId: ride.rideId, authorId: ride.driverId, rating, now: nextDay(index) })
      // La note que le passager donne au chauffeur ne compte pas dans la sienne.
      await rateRide({ rideId: ride.rideId, authorId: riderId, rating: 1, now: nextDay(index) })
      if (index === 3) expect(await riderRating(riderId)).toEqual({ average: null, count: 4 })
    }
    expect(await riderRating(riderId)).toEqual({ average: 4.4, count: 5 })
  })
})

describe('les commentaires reçus par le chauffeur', () => {
  it('montrent la note et le commentaire, les plus récents d’abord, sans rien de leur auteur', async () => {
    const first = await createCompletedRide({ completedAt })
    const second = await createCompletedRide({ driverId: first.driverId, completedAt })
    const silent = await createCompletedRide({ driverId: first.driverId, completedAt })
    await rateRide({ rideId: first.rideId, authorId: first.riderId, rating: 3, comment: 'Un peu brusque.', now: nextDay(1) })
    await rateRide({ rideId: second.rideId, authorId: second.riderId, rating: 5, comment: 'Très ponctuel.', now: nextDay(2) })
    await rateRide({ rideId: silent.rideId, authorId: silent.riderId, rating: 4, now: nextDay(3) })

    const items = await driverFeedback(first.driverId)
    expect(items).toEqual([
      { rating: 5, comment: 'Très ponctuel.' },
      { rating: 3, comment: 'Un peu brusque.' },
    ])
    const text = JSON.stringify(items)
    for (const id of [first.riderId, second.riderId, first.rideId, second.rideId]) {
      expect(text, 'un commentaire ne dit pas qui l’a écrit').not.toContain(id)
    }
  })
})
