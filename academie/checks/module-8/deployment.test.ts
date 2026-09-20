/**
 * Module 8 — Mise en production.
 *
 * Cette suite n'interroge pas votre code source : elle interroge **votre
 * application déployée**, à son URL publique. C'est la preuve qu'elle
 * fonctionne vraiment, hors de votre machine.
 *
 * Renseignez le secret `DEPLOYMENT_URL` dans les paramètres de votre dépôt
 * GitHub (Settings → Secrets and variables → Actions) avec l'adresse de votre
 * application — par exemple `https://mon-clone-uber.fly.dev`.
 */
import { describe, expect, it } from 'vitest'

const baseUrl = (process.env.DEPLOYMENT_URL ?? '').replace(/\/$/, '')
const timeout = 20_000

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    // Un déploiement endormi doit se réveiller, mais pas bloquer la suite.
    signal: AbortSignal.timeout(timeout),
  })
}

describe('application déployée', () => {
  it('a une URL de déploiement configurée', () => {
    expect(
      baseUrl,
      'Renseignez le secret DEPLOYMENT_URL avec l’URL publique de votre application.',
    ).toMatch(/^https?:\/\/.+/)
  })

  it('répond sur son point de santé', { timeout }, async () => {
    const response = await call('/health')
    expect(response.ok).toBe(true)
  })

  it('sert son API en HTTPS', () => {
    expect(baseUrl.startsWith('https://'), 'le déploiement doit être servi en HTTPS').toBe(
      true,
    )
  })

  it('accepte la création d’un passager', { timeout }, async () => {
    const response = await call('/passengers', {
      method: 'POST',
      body: JSON.stringify({
        email: `passager-${Date.now()}@example.org`,
        name: 'Passager de vérification',
      }),
    })
    expect([200, 201]).toContain(response.status)
  })

  it('accepte une demande de course et rend son identifiant', { timeout }, async () => {
    const response = await call('/rides', {
      method: 'POST',
      body: JSON.stringify({
        pickup: { lat: 45.5019, lon: -73.5674 },
        dropoff: { lat: 45.5088, lon: -73.554 },
      }),
    })
    expect([200, 201]).toContain(response.status)

    const body = (await response.json()) as { id?: string; rideId?: string }
    expect(
      body.id ?? body.rideId,
      'la réponse doit porter l’identifiant de la course',
    ).toBeTruthy()
  })

  it('refuse une demande de course mal formée', { timeout }, async () => {
    const response = await call('/rides', {
      method: 'POST',
      body: JSON.stringify({ pickup: 'Montréal' }),
    })
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })
})
