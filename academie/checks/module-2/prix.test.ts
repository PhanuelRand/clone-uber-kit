/**
 * Module 2 : Architecture, le prix d'une course.
 *
 * Un montant est un entier en ariary, qui n'a pas de centimes (décision 0002).
 * Le prix d'une course se calcule à partir du tarif de sa catégorie (décision
 * 0001), de la distance et de la durée du trajet :
 *
 *   brut       prise en charge
 *              + par kilomètre × mètres ÷ 1 000, arrondi à l'ariary inférieur
 *              + par minute × secondes ÷ 60, arrondi à l'ariary inférieur
 *   nuit       de 22 h 00 à 5 h 00, heure de Madagascar : brut + 20 % du brut,
 *              arrondis à l'ariary inférieur (décision 0006)
 *   minimum    le prix ne descend jamais sous le minimum du tarif
 *   arrondi    le prix s'arrondit à la centaine d'ariary supérieure : 5 839 Ar
 *              deviennent 5 900 Ar
 *
 * Contrat attendu, exporté par `src/academie/module-2.ts`, à côté de `Ride` :
 *
 *   export function computeFare(input: {
 *     tariff: { base: number; perKm: number; perMinute: number; minimum: number }
 *     distanceMeters: number       // un entier positif ou nul
 *     durationSeconds: number      // un entier positif ou nul
 *     at: string                   // l'instant de la demande, ISO 8601
 *   }): number                     // lève si la distance ou la durée n'est pas un entier positif ou nul
 *
 *   export function isNight(at: string): boolean
 *
 * Le calcul se fait en entiers : `Math.floor(brut * 20 / 100)`, sans passer
 * par `0.2`. Il ne dépend pas du fuseau de la machine qui l'exécute.
 */
import { describe, expect, it } from 'vitest'
import { computeFare, isNight } from '../../../src/academie/module-2'
import { inMadagascar } from '../_support/positions'

const voiture = { base: 2_000, perKm: 900, perMinute: 100, minimum: 5_000 }
const moto = { base: 1_000, perKm: 400, perMinute: 50, minimum: 2_000 }
const midi = inMadagascar('2030-07-15', '12:00')

describe('le calcul du prix', () => {
  it('additionne la prise en charge, la distance et la durée', () => {
    expect(computeFare({ tariff: voiture, distanceMeters: 5_000, durationSeconds: 900, at: midi })).toBe(8_000)
    expect(computeFare({ tariff: moto, distanceMeters: 4_000, durationSeconds: 720, at: midi })).toBe(3_200)
  })

  // 900 × 3,21 = 2 889 ; 100 × 9,5 = 950 ; 2 000 + 2 889 + 950 = 5 839.
  it('arrondit le prix à la centaine d’ariary supérieure', () => {
    expect(computeFare({ tariff: voiture, distanceMeters: 3_210, durationSeconds: 570, at: midi })).toBe(5_900)
  })

  it('compte chaque part à l’ariary inférieur, avant l’arrondi final', () => {
    const tariff = { base: 0, perKm: 999, perMinute: 7, minimum: 1 }
    // 999 × 0,1 = 99,9 -> 99 ; 7 × 0,15 = 1,05 -> 1 ; 100 en tout.
    expect(computeFare({ tariff, distanceMeters: 100, durationSeconds: 9, at: midi })).toBe(100)
  })

  it('ne descend jamais sous le minimum du tarif', () => {
    expect(computeFare({ tariff: voiture, distanceMeters: 800, durationSeconds: 180, at: midi })).toBe(5_000)
    expect(computeFare({ tariff: voiture, distanceMeters: 0, durationSeconds: 0, at: midi })).toBe(5_000)
  })

  it('rend des montants entiers', () => {
    for (const distanceMeters of [1, 333, 1_234, 9_999]) {
      const fare = computeFare({ tariff: voiture, distanceMeters, durationSeconds: 77, at: midi })
      expect(Number.isInteger(fare), `${fare} doit être un entier`).toBe(true)
      expect(fare % 100, `${fare} doit être une centaine ronde`).toBe(0)
    }
  })

  it('refuse une distance ou une durée négative, ou à virgule', () => {
    expect(() => computeFare({ tariff: voiture, distanceMeters: -1, durationSeconds: 60, at: midi })).toThrow()
    expect(() => computeFare({ tariff: voiture, distanceMeters: 1_000.5, durationSeconds: 60, at: midi })).toThrow()
    expect(() => computeFare({ tariff: voiture, distanceMeters: 1_000, durationSeconds: -60, at: midi })).toThrow()
    expect(() => computeFare({ tariff: voiture, distanceMeters: 1_000, durationSeconds: 60.5, at: midi })).toThrow()
  })
})

describe('le tarif de nuit', () => {
  it('ajoute 20 % la nuit, heure de Madagascar', () => {
    const at = inMadagascar('2030-07-15', '23:00')
    expect(computeFare({ tariff: voiture, distanceMeters: 5_000, durationSeconds: 900, at })).toBe(9_600)
  })

  // 2 000 + 900 × 3,21 + 950 = 5 839 ; 20 % font 1 167,8 -> 1 167 ; 7 006 -> 7 100.
  it('arrondit la majoration à l’ariary inférieur, puis le prix à la centaine supérieure', () => {
    const at = inMadagascar('2030-07-15', '23:00')
    expect(computeFare({ tariff: voiture, distanceMeters: 3_210, durationSeconds: 570, at })).toBe(7_100)
  })

  it('ne fait pas passer un trajet de nuit sous le minimum', () => {
    const at = inMadagascar('2030-07-16', '02:00')
    expect(computeFare({ tariff: voiture, distanceMeters: 800, durationSeconds: 180, at })).toBe(5_000)
  })
})

describe('la nuit, à l’heure de Madagascar', () => {
  it('commence à 22 h 00 et finit à 5 h 00, heure locale', () => {
    expect(isNight(inMadagascar('2030-07-15', '21:59')), '21 h 59').toBe(false)
    expect(isNight(inMadagascar('2030-07-15', '22:00')), '22 h 00').toBe(true)
    expect(isNight(inMadagascar('2030-07-16', '00:30')), '0 h 30').toBe(true)
    expect(isNight(inMadagascar('2030-07-16', '04:59')), '4 h 59').toBe(true)
    expect(isNight(inMadagascar('2030-07-16', '05:00')), '5 h 00').toBe(false)
  })

  // 19 h 30 UTC, c'est 22 h 30 à Antananarivo; 2 h 30 UTC, c'est 5 h 30.
  it('lit l’heure à Madagascar, pas en UTC', () => {
    expect(isNight('2030-07-15T19:30:00.000Z')).toBe(true)
    expect(isNight('2030-07-16T02:30:00.000Z')).toBe(false)
  })

  it('lit un instant écrit avec un autre décalage horaire', () => {
    expect(isNight('2030-07-15T23:30:00+03:00')).toBe(true)
    expect(isNight('2030-07-15T23:30:00+00:00'), '2 h 30 à Antananarivo').toBe(true)
    expect(isNight('2030-07-15T12:00:00+03:00')).toBe(false)
  })
})
