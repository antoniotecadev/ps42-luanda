// app/api/queue/route.ts

/**
 * Endpoint que retorna o estado completo da fila com dados enriquecidos. 
 * Usado pelo frontend para mostrar posições, tempo de espera estimado e sessão activa.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Sessão activa
    const activeSession = await prisma.session.findFirst({
        where: { status: 'ACTIVE' },
        include: {
            user: { select: { login: true, displayName: true, avatarUrl: true } },
            game: { select: { title: true, coverUrl: true } },
        },
    })

    // Fila de espera (pendentes + aprovados)
    const queue = await prisma.session.findMany({
        where: { status: { in: ['PENDING', 'APPROVED'] } },
        include: {
            user: { select: { login: true, displayName: true, avatarUrl: true } },
            game: { select: { title: true } },
        },
        orderBy: { requestedAt: 'asc' },
    })

    // Posição do utilizador actual
    const myPosition = queue.findIndex(s => s.userId === session.user.id) + 1

    // Tempo estimado de espera (60 min por sessão)

    // Se houver uma sessão activa, calcular o tempo restante com base no tempo decorrido desde o início da sessão, 
    // e adicionar 60 min para cada pessoa à frente na fila. 
    // Se não houver sessão activa, o tempo estimado é simplesmente a posição na fila multiplicada por 60 min.
    const estimatedWait = activeSession
        ? (() => {
            if (!activeSession.startedAt) return myPosition * 60
            const elapsed = (Date.now() - new Date(activeSession.startedAt).getTime()) / 60000
            const remaining = Math.max(0, 60 - elapsed)
            return remaining + (Math.max(0, myPosition - 1) * 60)
        })()
        : myPosition * 60

    return NextResponse.json({
        activeSession, // Detalhes da sessão activa, ou null se não houver
        queue, // Lista completa da fila, incluindo sessões pendentes e aprovadas, para exibição no frontend
        myPosition: myPosition > 0 ? myPosition : null, // Se o usuário não estiver na fila, retorna null para a posição
        estimatedWaitMin: Math.round(estimatedWait), // Arredonda para o minuto mais próximo
        queueSize: queue.length, // Tamanho total da fila para exibição no frontend
        consoleStatus: activeSession ? 'occupied' : queue.length > 0 ? 'queued' : 'free', // Status da consola para exibição no frontend: 'occupied' se houver sessão activa, 'queued' se houver pessoas na fila, ou 'free' se estiver vazia
    })
}