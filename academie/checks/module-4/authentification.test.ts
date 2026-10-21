/**
 * Module 4 : Mots de passe, comptes et droits.
 *
 * Deux sortes de personnes se servent de l'application : le passager qui
 * demande une course, et le chauffeur qui la fait. Un même compte peut tenir
 * les deux rôles : un chauffeur prend aussi un taxi-moto pour rentrer chez lui.
 *
 * Contrat attendu, exporté par `src/academie/module-4.ts`, à côté de
 * `normalizePhone` :
 *
 *   export class Account {
 *     static register(input: {
 *       email: string; name: string
 *       phone?: string           // facultatif; tel que la personne l'a tapé
 *     }): Account                // lève si le numéro est donné mais invalide
 *     readonly roles: Role[]     // ['RIDER'] à l'inscription
 *     readonly phone: string | null   // la forme unique, '+261…', ou null
 *     readonly status: 'ACTIVE' | 'SUSPENDED'
 *     readonly suspensionReason: string | null
 *     readonly driverStatus: 'NONE' | 'PENDING' | 'APPROVED'
 *     suspend(reason: string): void      // lève si le motif est vide
 *     reinstate(): void
 *     applyAsDriver(): void              // ajoute le rôle DRIVER, en attente de vérification
 *     approveDriver(): void              // lève si le compte n'a pas demandé à conduire
 *     canDrive(): boolean                // chauffeur vérifié, compte actif
 *   }
 *
 *   export function hashPassword(plain: string): Promise<string>
 *   export function verifyPassword(plain: string, hash: string): Promise<boolean>
 *
 *   export type Role = 'RIDER' | 'DRIVER'
 *   export type Action = 'REQUEST_RIDE' | 'DRIVE' | 'MANAGE_VEHICLE' | 'VIEW_RIDE' | 'EDIT_PROFILE'
 *
 *   export function authorize(input: {
 *     roles: Role[]                                 // [] pour un visiteur non connecté
 *     accountStatus?: 'ACTIVE' | 'SUSPENDED'        // absent : ACTIVE
 *     driverStatus?: 'NONE' | 'PENDING' | 'APPROVED'   // absent : NONE
 *     action: Action
 *     isParticipant?: boolean                       // pour VIEW_RIDE : il est le passager ou le chauffeur de la course
 *   }): { allowed: boolean; status: number }
 *
 * Demander une course demande le rôle RIDER. Conduire demande le rôle DRIVER,
 * et un chauffeur vérifié : la vérification de ses papiers se fait hors de
 * l'application, et un chauffeur en attente ne prend aucune course. Il peut en
 * revanche enregistrer son véhicule (`MANAGE_VEHICLE`) : c'est ce que l'équipe
 * vérifie. Lire une course demande d'en être le passager ou le chauffeur, quel
 * que soit le rôle. Un compte suspendu peut encore se connecter et corriger son
 * profil (`EDIT_PROFILE`), rien d'autre.
 *
 * `authorize` est la décision d'autorisation de votre serveur, isolée pour être
 * testable. Vos routes doivent l'appeler : masquer un bouton dans l'interface
 * n'est pas une autorisation.
 */
import { describe, expect, it } from 'vitest'
import { Account, authorize, hashPassword, verifyPassword } from '../../../src/academie/module-4'

const ALL_ACTIONS = ['REQUEST_RIDE', 'DRIVE', 'MANAGE_VEHICLE', 'VIEW_RIDE', 'EDIT_PROFILE'] as const

function registered() {
  return Account.register({ email: 'voahangy@example.org', name: 'Voahangy' })
}

describe('l’inscription', () => {
  it('crée un compte de passager actif', () => {
    const account = registered()
    expect(account.status).toBe('ACTIVE')
    expect(account.roles).toEqual(['RIDER'])
    expect(account.driverStatus).toBe('NONE')
    expect(account.canDrive()).toBe(false)
  })

  it('range le numéro sous sa forme unique', () => {
    const account = Account.register({ email: 'tojo@example.org', name: 'Tojo', phone: '034 12 345 67' })
    expect(account.phone).toBe('+261341234567')
  })

  it('accepte un compte sans numéro', () => {
    expect(registered().phone).toBeNull()
  })

  it('refuse un numéro qui n’est pas valide', () => {
    expect(() => Account.register({ email: 'x@example.org', name: 'X', phone: '12345' })).toThrow()
  })
})

describe('devenir chauffeur', () => {
  it('ajoute le rôle de chauffeur, en attente de vérification', () => {
    const account = registered()
    account.applyAsDriver()
    expect(account.roles).toContain('DRIVER')
    expect(account.roles, 'un chauffeur reste passager').toContain('RIDER')
    expect(account.driverStatus).toBe('PENDING')
    expect(account.canDrive(), 'un chauffeur en attente ne conduit pas').toBe(false)
  })

  it('laisse conduire un chauffeur vérifié', () => {
    const account = registered()
    account.applyAsDriver()
    account.approveDriver()
    expect(account.driverStatus).toBe('APPROVED')
    expect(account.canDrive()).toBe(true)
  })

  it('refuse de vérifier un compte qui n’a pas demandé à conduire', () => {
    expect(() => registered().approveDriver()).toThrow()
  })

  it('empêche un chauffeur suspendu de conduire', () => {
    const account = registered()
    account.applyAsDriver()
    account.approveDriver()
    account.suspend('Courses annulées sur place, à répétition')
    expect(account.canDrive()).toBe(false)
  })
})

describe('la suspension', () => {
  it('suspend un compte avec un motif lisible', () => {
    const account = registered()
    account.suspend('Comportement signalé par plusieurs chauffeurs')
    expect(account.status).toBe('SUSPENDED')
    expect(account.suspensionReason).toContain('signalé')
  })

  it('refuse une suspension sans motif', () => {
    expect(() => registered().suspend('  ')).toThrow()
  })

  it('rend ses droits à un compte réintégré', () => {
    const account = registered()
    account.suspend('Signalé par erreur')
    account.reinstate()
    expect(account.status).toBe('ACTIVE')
    expect(account.suspensionReason).toBeNull()
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

  it('reconnaît le bon mot de passe et rejette le mauvais', async () => {
    const hash = await hashPassword('mot-de-passe-de-test-1')
    expect(await verifyPassword('mot-de-passe-de-test-1', hash)).toBe(true)
    expect(await verifyPassword('mot-de-passe-de-test-2', hash)).toBe(false)
  })
})

describe('autorisation côté serveur', () => {
  it('refuse un visiteur anonyme avec 401', () => {
    for (const action of ALL_ACTIONS) {
      const decision = authorize({ roles: [], action, isParticipant: true, driverStatus: 'APPROVED' })
      expect(decision.allowed, `un visiteur ne doit pas pouvoir ${action}`).toBe(false)
      expect(decision.status).toBe(401)
    }
  })

  it('laisse un passager demander une course et corriger son profil, sans conduire', () => {
    expect(authorize({ roles: ['RIDER'], action: 'REQUEST_RIDE' }).allowed).toBe(true)
    expect(authorize({ roles: ['RIDER'], action: 'EDIT_PROFILE' }).allowed).toBe(true)
    for (const action of ['DRIVE', 'MANAGE_VEHICLE'] as const) {
      const decision = authorize({ roles: ['RIDER'], action })
      expect(decision.allowed, `un simple passager ne doit pas pouvoir ${action}`).toBe(false)
      expect(decision.status).toBe(403)
    }
  })

  it('laisse conduire un chauffeur vérifié, et refuse un chauffeur en attente avec 403', () => {
    expect(authorize({ roles: ['RIDER', 'DRIVER'], driverStatus: 'APPROVED', action: 'DRIVE' }).allowed).toBe(true)

    const pending = authorize({ roles: ['RIDER', 'DRIVER'], driverStatus: 'PENDING', action: 'DRIVE' })
    expect(pending.allowed).toBe(false)
    expect(pending.status).toBe(403)

    const unknown = authorize({ roles: ['DRIVER'], action: 'DRIVE' })
    expect(unknown.allowed, 'sans driverStatus, le chauffeur n’est pas vérifié').toBe(false)
  })

  // Le véhicule est ce que l'équipe vérifie : il s'enregistre avant l'approbation.
  it('laisse un chauffeur en attente enregistrer son véhicule', () => {
    expect(authorize({ roles: ['RIDER', 'DRIVER'], driverStatus: 'PENDING', action: 'MANAGE_VEHICLE' }).allowed).toBe(true)
    expect(authorize({ roles: ['RIDER', 'DRIVER'], driverStatus: 'APPROVED', action: 'MANAGE_VEHICLE' }).allowed).toBe(true)
  })

  // Le cœur du module : être connecté ne suffit pas, il faut être dans la course.
  it('ne montre une course qu’à son passager et à son chauffeur, et refuse les autres avec 403', () => {
    expect(authorize({ roles: ['RIDER'], action: 'VIEW_RIDE', isParticipant: true }).allowed).toBe(true)
    expect(authorize({ roles: ['DRIVER'], driverStatus: 'APPROVED', action: 'VIEW_RIDE', isParticipant: true }).allowed).toBe(true)

    const other = authorize({ roles: ['RIDER', 'DRIVER'], driverStatus: 'APPROVED', action: 'VIEW_RIDE', isParticipant: false })
    expect(other.allowed).toBe(false)
    expect(other.status).toBe(403)

    const unknown = authorize({ roles: ['RIDER'], action: 'VIEW_RIDE' })
    expect(unknown.allowed, 'sans isParticipant, la course n’est pas la sienne').toBe(false)
  })

  it('refuse tout sauf le profil à un compte suspendu, avec 403', () => {
    const roles = ['RIDER', 'DRIVER'] as ('RIDER' | 'DRIVER')[]
    for (const action of ['REQUEST_RIDE', 'DRIVE', 'MANAGE_VEHICLE', 'VIEW_RIDE'] as const) {
      const decision = authorize({ roles, accountStatus: 'SUSPENDED', driverStatus: 'APPROVED', action, isParticipant: true })
      expect(decision.allowed, `un compte suspendu ne doit pas pouvoir ${action}`).toBe(false)
      expect(decision.status).toBe(403)
    }
    expect(authorize({ roles, accountStatus: 'SUSPENDED', action: 'EDIT_PROFILE' }).allowed).toBe(true)
  })

  it('refuse à un chauffeur sans le rôle de passager de demander une course', () => {
    const decision = authorize({ roles: ['DRIVER'], driverStatus: 'APPROVED', action: 'REQUEST_RIDE' })
    expect(decision.allowed).toBe(false)
    expect(decision.status).toBe(403)
  })
})
