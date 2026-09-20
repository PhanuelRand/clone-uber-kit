/**
 * Module 1 — Fondations et modèle du domaine.
 *
 * Suite de conformité écrite par l'Académie. Elle appelle VOTRE code à travers
 * l'interface convenue dans la consigne du module. Ces fichiers font partie du
 * harnais : les modifier confie votre remise à un mentor.
 *
 * Interface attendue, exportée par `src/domain/ride.ts` :
 *
 *   export type RideStatus =
 *     'REQUESTED' | 'OFFERED' | 'ACCEPTED' | 'ARRIVED'
 *     | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
 *
 *   export class Ride {
 *     static request(input: {
 *       passengerId: string
 *       fareCents: number
 *       currency: string
 *     }): Ride
 *     readonly status: RideStatus
 *     readonly fareCents: number
 *     transitionTo(next: RideStatus): void   // lève si la transition est interdite
 *   }
 */
import { describe, expect, it } from 'vitest'
import { Ride } from '../../../src/domain/ride'

const passengerId = '11111111-1111-4111-8111-111111111111'

function requested() {
  return Ride.request({ passengerId, fareCents: 1250, currency: 'CAD' })
}

describe('cycle de vie d’une course', () => {
  it('naît à l’état demandé', () => {
    expect(requested().status).toBe('REQUESTED')
  })

  it('suit le chemin nominal jusqu’à la fin de course', () => {
    const ride = requested()
    for (const step of ['OFFERED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']) {
      ride.transitionTo(step as never)
    }
    expect(ride.status).toBe('COMPLETED')
  })

  it('refuse de terminer une course jamais acceptée', () => {
    expect(() => requested().transitionTo('COMPLETED')).toThrow()
  })

  it('refuse de rouvrir une course terminée', () => {
    const ride = requested()
    for (const step of ['OFFERED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']) {
      ride.transitionTo(step as never)
    }
    expect(() => ride.transitionTo('IN_PROGRESS')).toThrow()
  })

  it('refuse de reprendre une course annulée', () => {
    const ride = requested()
    ride.transitionTo('CANCELLED')
    expect(() => ride.transitionTo('ACCEPTED')).toThrow()
  })

  // Critère c4 : un montant en virgule flottante finit par produire des écarts
  // de centimes sur un relevé bancaire.
  it('conserve le montant en centimes entiers', () => {
    const ride = Ride.request({ passengerId, fareCents: 1250, currency: 'CAD' })
    expect(Number.isInteger(ride.fareCents)).toBe(true)
    expect(ride.fareCents).toBe(1250)
  })
})
