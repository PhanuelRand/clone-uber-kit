/**
 * Module 2 — Authentification et profils vérifiés.
 *
 * Interface attendue, exportée par `src/domain/driver.ts` :
 *
 *   export class Driver {
 *     static register(input: { email: string; name: string }): Driver
 *     readonly verification: 'PENDING' | 'APPROVED' | 'REJECTED'
 *     readonly rejectionReason: string | null
 *     approve(): void
 *     reject(reason: string): void
 *     canGoOnline(): boolean
 *   }
 *
 * Et par `src/auth/password.ts` : `hashPassword(plain): Promise<string>`.
 */
import { describe, expect, it } from 'vitest'
import { Driver } from '../../../src/domain/driver'
import { hashPassword } from '../../../src/auth/password'

function registered() {
  return Driver.register({ email: 'alex@example.org', name: 'Alex' })
}

describe('vérification du chauffeur', () => {
  it('interdit de passer en ligne tant que la vérification est en attente', () => {
    const driver = registered()
    expect(driver.verification).toBe('PENDING')
    expect(driver.canGoOnline()).toBe(false)
  })

  it('autorise la mise en ligne une fois approuvé', () => {
    const driver = registered()
    driver.approve()
    expect(driver.verification).toBe('APPROVED')
    expect(driver.canGoOnline()).toBe(true)
  })

  it('garde un chauffeur refusé hors ligne, avec un motif lisible', () => {
    const driver = registered()
    driver.reject('Permis expiré')
    expect(driver.canGoOnline()).toBe(false)
    expect(driver.rejectionReason).toContain('Permis')
  })
})

describe('stockage des mots de passe', () => {
  it('ne conserve jamais le mot de passe en clair', async () => {
    const hash = await hashPassword('mot-de-passe-de-test-1')
    expect(hash).not.toContain('mot-de-passe-de-test-1')
    expect(hash.length).toBeGreaterThan(20)
  })

  // Un hachage sans sel se casse avec une table pré-calculée.
  it('sale le hachage : deux hachages du même mot de passe diffèrent', async () => {
    const [first, second] = await Promise.all([
      hashPassword('mot-de-passe-de-test-1'),
      hashPassword('mot-de-passe-de-test-1'),
    ])
    expect(first).not.toBe(second)
  })
})
