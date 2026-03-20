/**
 * Pusher é o motor WebSocket do sistema — gere a fila em tempo real, 
 * os timers de sessão e as notificações instantâneas sem refresh.
 */

import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

// ── Server-side (API routes) ──────────────────────────────────────────────
export const pusherServer = new PusherServer({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
})

// ── Client-side (componentes React) ──────────────────────────────────────
export const pusherClient = new PusherClient(
    process.env.NEXT_PUBLIC_PUSHER_KEY!,
    { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! }
)

// ── Canais e eventos PS42 ─────────────────────────────────────────────────
export const CHANNELS = {
    QUEUE: 'ps42-queue',          // Estado global da fila
    SESSION: 'ps42-session',        // Sessão activa
    STAFF: 'ps42-staff',          // Notificações staff
} as const

export const EVENTS = {
    QUEUE_UPDATED: 'queue:updated', // Actualização do estado da fila (posição, tempo estimado, etc.)
    SESSION_STARTED: 'session:started', // Início de uma sessão de atendimento
    SESSION_ENDED: 'session:ended', // Fim de uma sessão de atendimento
    SESSION_TIMER: 'session:timer', // Actualização do temporizador da sessão (tempo restante, etc.)
    NEW_REQUEST: 'staff:new-request', // Notificação de nova solicitação na fila (para staff)
    REQUEST_APPROVED: 'staff:approved', // Notificação de solicitação aprovada (para staff e usuário)
    REQUEST_REJECTED: 'staff:rejected', // Notificação de solicitação rejeitada (para staff e usuário)
} as const