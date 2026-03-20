/**
 * Upstash Redis para cache de elegibilidade (15 min), sessão activa e rate limiting da API 42.
 */

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ── Cliente Redis singleton ───────────────────────────────────────────────
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ── Rate limiter para API 42 Intra (10 req/min por utilizador) ────────────
export const intraRatelimit = new Ratelimit({
    redis, // O mesmo cliente Redis para partilhar o estado do rate limit entre todas as instâncias da aplicação
    limiter: Ratelimit.slidingWindow(10, '1 m'), // Limite de 10 requisições por minuto
    analytics: true, // Habilita analytics para monitorar o uso do rate limit e identificar possíveis abusos ou necessidades de ajuste
    prefix: 'ps42:intra', // Prefixo para as chaves de rate limit no Redis, garantindo que sejam facilmente identificáveis e organizadas dentro do banco de dados Redis, especialmente se estiveres usando o mesmo banco para outros propósitos além do rate limiting da API 42 Intra.
})

// ── Helpers de cache ─────────────────────────────────────────────────────
export const cache = {
    // Elegibilidade — 15 minutos
    eligibility: {
        key: (userId: string) => `eligibility:${userId}`,
        ttl: 900,
    },
    // Sessão activa — tempo real
    activeSession: {
        key: () => 'active-session',
        ttl: 3600,
    },
    // Fila actual — 30 segundos
    queue: {
        key: () => 'queue:current',
        ttl: 30,
    },
}