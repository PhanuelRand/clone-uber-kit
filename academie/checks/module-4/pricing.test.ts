/**
 * Module 4 — Estimation et tarification.
 *
 * Interface attendue, exportée par `src/pricing/estimate.ts` :
 *
 *   export function estimateFare(input: {
 *     distanceMeters: number
 *     durationSeconds: number
 *     demandMultiplier?: number
 *   }): { amountCents: number; currency: string; tariffVersion: string }
 */
import { describe, expect, it } from 'vitest'
import { estimateFare } from '../../../src/pricing/estimate'

const course = { distanceMeters: 5_000, durationSeconds: 900 }

describe('estimation du prix', () => {
  it('rend un montant en centimes entiers avec sa devise', () => {
    const estimate = estimateFare(course)
    expect(Number.isInteger(estimate.amountCents)).toBe(true)
    expect(estimate.amountCents).toBeGreaterThan(0)
    expect(estimate.currency).toMatch(/^[A-Z]{3}$/)
  })

  it('applique un minimum de course sur un trajet très court', () => {
    const court = estimateFare({ distanceMeters: 120, durationSeconds: 40 })
    expect(court.amountCents).toBeGreaterThan(0)
    expect(court.amountCents).toBeLessThan(estimateFare(course).amountCents)
  })

  it('croît avec la distance et avec la durée', () => {
    const base = estimateFare(course)
    const plusLoin = estimateFare({ ...course, distanceMeters: 10_000 })
    const plusLong = estimateFare({ ...course, durationSeconds: 1_800 })
    expect(plusLoin.amountCents).toBeGreaterThan(base.amountCents)
    expect(plusLong.amountCents).toBeGreaterThan(base.amountCents)
  })

  it('majore en période de forte demande', () => {
    const majore = estimateFare({ ...course, demandMultiplier: 1.8 })
    expect(majore.amountCents).toBeGreaterThan(estimateFare(course).amountCents)
  })

  // Sans version de tarif conservée, un montant contesté est indéfendable.
  it('rend la version du tarif appliqué', () => {
    expect(estimateFare(course).tariffVersion).toBeTruthy()
  })
})
