/**
 * Module 16 : La messagerie entre le passager et le chauffeur. Module Platine.
 *
 * « Je suis devant la pharmacie », « Je porte un sac rouge » : le passager et
 * le chauffeur se parlent pendant l'approche, sans jamais échanger leurs
 * numéros. La conversation s'ouvre quand un chauffeur accepte la course, et se
 * ferme trente minutes après la fin de la course. Trois règles :
 *
 * - seuls le passager et le chauffeur de la course lisent et écrivent, et le
 *   serveur le vérifie à chaque lecture, à chaque envoi et à chaque abonnement;
 * - un numéro de téléphone écrit dans un message est masqué avant d'être
 *   rangé : la messagerie remplace l'échange de numéros, elle ne le permet pas;
 * - trente minutes après la fin de la course, terminée ou annulée, on ne peut
 *   plus écrire : l'historique se relit, mais la conversation est close.
 *
 * Contrat attendu, exporté par `src/academie/module-16.ts` :
 *
 *   export function createAccount(input?: { ...ceux du module 6 }): Promise<string>
 *   export function createDriver(input?: { ...ceux du module 7 })
 *   export function createRequestedRide(input?: { ...ceux du module 10 })
 *   export function acceptRide, arrive, startRide, completeRide, cancelRide   // module 10
 *
 *   export function openChat(input: { rideId: string; memberId: string }): Promise<{
 *     status: number               // 201, ou 200 si elle existe déjà; 403 pour un tiers;
 *                                  // 409 tant qu'aucun chauffeur n'a accepté la course
 *     conversationId?: string      // la même pour le passager et pour le chauffeur
 *   }>
 *
 *   export function sendMessage(input: {
 *     conversationId: string; senderId: string; body: string
 *     now: string                  // un instant ISO 8601
 *   }): Promise<{ status: number }>   // 201; 400 vide ou de plus de 500 caractères;
 *                                     // 403 pour un tiers; 410 conversation close
 *
 *   export function readConversation(input: { conversationId: string; readerId: string }): Promise<{
 *     status: number
 *     messages: { senderId: string; body: string }[]   // dans l'ordre d'envoi
 *   }>
 *
 *   export function subscribe(input: {
 *     conversationId: string; readerId: string
 *     onMessage: (message: { senderId: string; body: string }) => void
 *   }): Promise<{ status: number; unsubscribe: () => void }>
 *
 * Un numéro masqué devient le texte « [numéro masqué] ». Sont masqués les
 * numéros de téléphone mobile de Madagascar, sous toutes les écritures du
 * module 4 : « 034 12 345 67 », « 0341234567 », « +261 34 12 345 67 ».
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  acceptRide,
  arrive,
  cancelRide,
  completeRide,
  createAccount,
  createDriver,
  createRequestedRide,
  openChat,
  readConversation,
  sendMessage,
  startRide,
  subscribe,
} from '../../../src/academie/module-16'
import { inMinutes, somewhere } from '../_support/positions'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

/** Une course demandée, et un chauffeur tout près. */
async function requested() {
  const pickup = somewhere()
  const ride = await createRequestedRide({ pickup })
  const { driverId } = await createDriver({ position: pickup })
  return { ...ride, pickup, driverId }
}

/** Une course acceptée, et la conversation ouverte par le passager. */
async function chat() {
  const ride = await requested()
  await acceptRide({ rideId: ride.rideId, driverId: ride.driverId, now: inMinutes(0) })
  const opened = await openChat({ rideId: ride.rideId, memberId: ride.riderId })
  if (!opened.conversationId) throw new Error(`conversation refusée : ${opened.status}`)
  return { ...ride, conversationId: opened.conversationId }
}

describe('ouvrir la conversation', () => {
  it('attend qu’un chauffeur ait accepté la course', async () => {
    const { rideId, riderId } = await requested()
    expect((await openChat({ rideId, memberId: riderId })).status).toBe(409)
  })

  it('ouvre une seule conversation, la même pour le passager et le chauffeur', async () => {
    const { rideId, riderId, driverId, conversationId } = await chat()
    const again = await openChat({ rideId, memberId: riderId })
    const forDriver = await openChat({ rideId, memberId: driverId })

    expect(again.status).toBe(200)
    expect(again.conversationId).toBe(conversationId)
    expect(forDriver.conversationId).toBe(conversationId)
  })

  it('refuse la conversation à un tiers et à un autre chauffeur, avec 403', async () => {
    const { rideId, pickup } = await chat()
    const otherDriver = (await createDriver({ position: pickup })).driverId
    for (const memberId of [await createAccount(), otherDriver]) {
      expect((await openChat({ rideId, memberId })).status).toBe(403)
    }
  })
})

describe('entre le passager et le chauffeur', () => {
  it('rend les messages aux deux, dans l’ordre d’envoi', async () => {
    const { conversationId, riderId, driverId } = await chat()
    expect((await sendMessage({ conversationId, senderId: driverId, body: 'Je suis devant la pharmacie.', now: inMinutes(0) })).status).toBe(201)
    await sendMessage({ conversationId, senderId: riderId, body: 'J’arrive, deux minutes.', now: inMinutes(0) })

    for (const readerId of [riderId, driverId]) {
      const result = await readConversation({ conversationId, readerId })
      expect(result.status).toBe(200)
      expect(result.messages).toEqual([
        { senderId: driverId, body: 'Je suis devant la pharmacie.' },
        { senderId: riderId, body: 'J’arrive, deux minutes.' },
      ])
    }
  })

  it('refuse un message vide, ou de plus de 500 caractères, avec 400', async () => {
    const { conversationId, riderId } = await chat()
    expect((await sendMessage({ conversationId, senderId: riderId, body: '  ', now: inMinutes(0) })).status).toBe(400)
    expect((await sendMessage({ conversationId, senderId: riderId, body: 'a'.repeat(501), now: inMinutes(0) })).status).toBe(400)
    expect((await readConversation({ conversationId, readerId: riderId })).messages).toEqual([])
  })

  it('diffuse un message à l’autre dès son envoi', async () => {
    const { conversationId, riderId, driverId } = await chat()
    const received = new Promise<{ senderId: string; body: string }>((resolveMessage, reject) => {
      const timer = setTimeout(() => reject(new Error('aucun message reçu en 3 s')), 3_000)
      void subscribe({
        conversationId,
        readerId: riderId,
        onMessage: (message) => {
          clearTimeout(timer)
          resolveMessage(message)
        },
      }).then((subscription) => cleanups.push(subscription.unsubscribe))
    })
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))

    await sendMessage({ conversationId, senderId: driverId, body: 'Je suis la Vitz blanche.', now: inMinutes(0) })
    expect((await received).body).toBe('Je suis la Vitz blanche.')
  })
})

describe('les numéros de téléphone', () => {
  it('masque un numéro écrit dans un message, sous toutes ses écritures', async () => {
    const { conversationId, riderId } = await chat()
    for (const body of [
      'Appelez-moi au 034 12 345 67 en arrivant',
      'Mon numéro : 0341234567',
      'Sinon le +261 34 12 345 67',
    ]) {
      expect((await sendMessage({ conversationId, senderId: riderId, body, now: inMinutes(0) })).status).toBe(201)
    }

    const messages = (await readConversation({ conversationId, readerId: riderId })).messages
    for (const message of messages) {
      expect(message.body, 'le numéro ne doit pas être rangé').not.toMatch(/12\s?345\s?67|1234567/)
      expect(message.body).toContain('[numéro masqué]')
    }
    expect(messages[0]?.body).toBe('Appelez-moi au [numéro masqué] en arrivant')
  })

  it('laisse passer les autres nombres', async () => {
    const { conversationId, riderId } = await chat()
    await sendMessage({ conversationId, senderId: riderId, body: 'Lot IVG 45, portail 12, code 2024', now: inMinutes(0) })
    expect((await readConversation({ conversationId, readerId: riderId })).messages[0]?.body).toBe('Lot IVG 45, portail 12, code 2024')
  })
})

describe('fermée aux tiers', () => {
  it('refuse la lecture, l’envoi et l’abonnement à un tiers, avec 403', async () => {
    const { conversationId, riderId } = await chat()
    await sendMessage({ conversationId, senderId: riderId, body: 'Je suis sous l’arbre.', now: inMinutes(0) })
    const stranger = await createAccount()

    const read = await readConversation({ conversationId, readerId: stranger })
    expect(read.status).toBe(403)
    expect(read.messages).toEqual([])
    expect((await sendMessage({ conversationId, senderId: stranger, body: 'Intrus', now: inMinutes(0) })).status).toBe(403)
    const subscription = await subscribe({ conversationId, readerId: stranger, onMessage: () => undefined })
    cleanups.push(subscription.unsubscribe)
    expect(subscription.status).toBe(403)
  })
})

describe('la fin de la conversation', () => {
  async function completed() {
    const conversation = await chat()
    await arrive({ rideId: conversation.rideId, driverId: conversation.driverId })
    await startRide({ rideId: conversation.rideId, driverId: conversation.driverId, code: conversation.startCode })
    await completeRide({ rideId: conversation.rideId, driverId: conversation.driverId, now: inMinutes(0) })
    return conversation
  }

  it('reste ouverte pendant la course, et la demi-heure qui suit', async () => {
    const { conversationId, riderId } = await completed()
    expect((await sendMessage({ conversationId, senderId: riderId, body: 'J’ai oublié mon parapluie !', now: inMinutes(29) })).status).toBe(201)
  })

  it('se ferme trente minutes après la fin de la course, avec 410, mais se relit encore', async () => {
    const { conversationId, riderId, driverId } = await completed()
    await sendMessage({ conversationId, senderId: driverId, body: 'Bonne journée.', now: inMinutes(1) })

    expect((await sendMessage({ conversationId, senderId: riderId, body: 'Encore là ?', now: inMinutes(31) })).status).toBe(410)
    const read = await readConversation({ conversationId, readerId: riderId })
    expect(read.status).toBe(200)
    expect(read.messages.map((message) => message.body)).toEqual(['Bonne journée.'])
  })

  it('se ferme aussi trente minutes après une annulation', async () => {
    const { conversationId, rideId, riderId } = await chat()
    await cancelRide({ rideId, memberId: riderId, now: inMinutes(0) })
    expect((await sendMessage({ conversationId, senderId: riderId, body: 'Désolé, j’ai trouvé un taxi.', now: inMinutes(5) })).status).toBe(201)
    expect((await sendMessage({ conversationId, senderId: riderId, body: 'Toujours là ?', now: inMinutes(31) })).status).toBe(410)
  })
})
