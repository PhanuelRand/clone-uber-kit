/**
 * Module 7 — Paiement et clôture.
 *
 * Un appel réseau qui échoue ne veut pas dire que rien ne s'est passé : une
 * reprise ne doit jamais produire un second débit.
 *
 * Interface attendue, exportée par `src/payments/capture.ts` :
 *
 *   export async function captureFare(input: {
 *     rideId: string; amountCents: number; idempotencyKey: string
 *   }): Promise<{ captured: boolean; chargeId: string }>
 *
 *   export async function listCharges(rideId: string):
 *     Promise<{ chargeId: string; amountCents: number }[]>
 *
 *   export function verifyWebhookSignature(payload: string, signature: string): boolean
 */
import { describe, expect, it } from 'vitest'
import {
  captureFare,
  listCharges,
  verifyWebhookSignature,
} from '../../../src/payments/capture'

describe('idempotence du débit', () => {
  it('ne débite qu’une fois quand la même capture est rejouée', async () => {
    const rideId = `ride-rejeu-${Date.now()}`
    const idempotencyKey = `capture-${rideId}`

    const first = await captureFare({ rideId, amountCents: 1500, idempotencyKey })
    const replay = await captureFare({ rideId, amountCents: 1500, idempotencyKey })

    expect(first.chargeId).toBe(replay.chargeId)
    expect(await listCharges(rideId)).toHaveLength(1)
  })

  it('ne débite qu’une fois sous captures simultanées', async () => {
    const rideId = `ride-concurrent-${Date.now()}`
    const idempotencyKey = `capture-${rideId}`

    await Promise.all(
      Array.from({ length: 4 }, () =>
        captureFare({ rideId, amountCents: 1500, idempotencyKey }),
      ),
    )
    expect(await listCharges(rideId)).toHaveLength(1)
  })

  it('débite le montant demandé', async () => {
    const rideId = `ride-montant-${Date.now()}`
    await captureFare({
      rideId,
      amountCents: 2375,
      idempotencyKey: `capture-${rideId}`,
    })
    expect((await listCharges(rideId))[0]?.amountCents).toBe(2375)
  })
})

describe('webhooks', () => {
  it('rejette une signature invalide', () => {
    expect(verifyWebhookSignature('{"id":"evt_1"}', 'signature-inventee')).toBe(false)
  })
})
