/**
 * Module 2 : Architecture, le cycle de vie d'une course.
 *
 * Suite de conformité écrite par l'Académie. Elle appelle VOTRE code à travers
 * le fichier traducteur du module. Ces fichiers font partie du harnais : les
 * modifier confie votre remise à un mentor.
 *
 * Contrat attendu, exporté par `src/academie/module-2.ts` :
 *
 *   export type RideStatus =
 *     | 'REQUESTED' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS'
 *     | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
 *
 *   export class Ride {
 *     static request(input: {
 *       riderId: string
 *       category: 'moto' | 'voiture' | 'familiale'
 *       fare: number                 // le prix annoncé, en ariary
 *     }): Ride                       // lève si la catégorie est inconnue, ou le prix pas un entier > 0
 *     readonly status: RideStatus
 *     readonly fare: number
 *     transitionTo(next: RideStatus): void   // lève si le passage est interdit
 *   }
 *
 * Une course naît demandée (REQUESTED). Un chauffeur l'accepte (ACCEPTED),
 * arrive au point de départ (ARRIVED), fait monter le passager et démarre
 * (IN_PROGRESS), puis termine (COMPLETED). Sans chauffeur au bout de quelques
 * minutes, la demande expire (EXPIRED). Le passager, ou le chauffeur, peut
 * annuler (CANCELLED) tant que le passager n'est pas monté.
 *
 *   REQUESTED    -> ACCEPTED, CANCELLED, EXPIRED
 *   ACCEPTED     -> ARRIVED, CANCELLED
 *   ARRIVED      -> IN_PROGRESS, CANCELLED
 *   IN_PROGRESS  -> COMPLETED
 *   COMPLETED, CANCELLED, EXPIRED -> rien
 *
 * Tout autre passage lève une erreur, y compris rester dans le même statut.
 */
import { describe, expect, it } from 'vitest'
import { Ride } from '../../../src/academie/module-2'

const rider = '11111111-1111-4111-8111-111111111111'

function requested() {
  return Ride.request({ riderId: rider, category: 'voiture', fare: 8_000 })
}

function advanceTo(ride: Ride, steps: string[]) {
  for (const step of steps) ride.transitionTo(step as never)
  return ride
}

const ALLOWED: Record<string, string[]> = {
  REQUESTED: ['ACCEPTED', 'CANCELLED', 'EXPIRED'],
  ACCEPTED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
}

/** Le chemin le plus court pour amener une course neuve à ce statut. */
const PATH_TO: Record<string, string[]> = {
  REQUESTED: [],
  ACCEPTED: ['ACCEPTED'],
  ARRIVED: ['ACCEPTED', 'ARRIVED'],
  IN_PROGRESS: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'],
  COMPLETED: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'],
  CANCELLED: ['CANCELLED'],
  EXPIRED: ['EXPIRED'],
}

const STATUSES = Object.keys(ALLOWED)

describe('la naissance d’une course', () => {
  it('naît demandée, au prix annoncé', () => {
    const ride = requested()
    expect(ride.status).toBe('REQUESTED')
    expect(ride.fare).toBe(8_000)
  })

  it('accepte les trois catégories de la décision 0001', () => {
    for (const category of ['moto', 'voiture', 'familiale']) {
      expect(Ride.request({ riderId: rider, category: category as never, fare: 3_000 }).status).toBe('REQUESTED')
    }
  })

  it('refuse une catégorie inconnue', () => {
    expect(() => Ride.request({ riderId: rider, category: 'helicoptere' as never, fare: 8_000 })).toThrow()
  })

  it('refuse un prix nul, négatif ou à virgule', () => {
    for (const fare of [0, -500, 7_999.5]) {
      expect(() => Ride.request({ riderId: rider, category: 'voiture', fare }), `prix ${fare}`).toThrow()
    }
  })
})

describe('cycle de vie d’une course', () => {
  it('va de la demande jusqu’à l’arrivée', () => {
    const ride = advanceTo(requested(), ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'])
    expect(ride.status).toBe('COMPLETED')
  })

  it('expire sans chauffeur', () => {
    expect(advanceTo(requested(), ['EXPIRED']).status).toBe('EXPIRED')
  })

  it('se laisse annuler tant que le passager n’est pas monté', () => {
    expect(advanceTo(requested(), ['CANCELLED']).status).toBe('CANCELLED')
    expect(advanceTo(requested(), ['ACCEPTED', 'CANCELLED']).status).toBe('CANCELLED')
    expect(advanceTo(requested(), ['ACCEPTED', 'ARRIVED', 'CANCELLED']).status).toBe('CANCELLED')
  })

  // Le passager est dans la voiture : on ne revient plus en arrière.
  it('refuse d’annuler une course commencée', () => {
    const ride = advanceTo(requested(), ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'])
    expect(() => ride.transitionTo('CANCELLED' as never)).toThrow()
  })

  it('refuse de démarrer une course sans chauffeur arrivé', () => {
    expect(() => requested().transitionTo('IN_PROGRESS' as never)).toThrow()
    expect(() => advanceTo(requested(), ['ACCEPTED']).transitionTo('IN_PROGRESS' as never)).toThrow()
  })

  it('ne laisse rien sortir d’une course terminée', () => {
    for (const next of STATUSES) {
      const ride = advanceTo(requested(), PATH_TO.COMPLETED ?? [])
      expect(() => ride.transitionTo(next as never), `COMPLETED vers ${next}`).toThrow()
    }
  })
})

describe('le tableau complet des passages', () => {
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const allowed = ALLOWED[from]?.includes(to) ?? false
      it(`${allowed ? 'permet' : 'refuse'} ${from} vers ${to}`, () => {
        const ride = advanceTo(requested(), PATH_TO[from] ?? [])
        if (allowed) {
          ride.transitionTo(to as never)
          expect(ride.status).toBe(to)
        } else {
          expect(() => ride.transitionTo(to as never)).toThrow()
          expect(ride.status, 'un passage refusé ne change pas le statut').toBe(from)
        }
      })
    }
  }
})
