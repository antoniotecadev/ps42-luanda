 // api/sessions/route.ts

/**
 *  API Routes para criar, actualizar e consultar sessões. 
 *  Inclui todas as validações do regulamento: horário, elegibilidade, 30 minutos de antecedência.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkEligibility, isWithinOperatingHours } from '@/lib/eligibility'
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const CreateSessionSchema = z.object({
    gameId: z.string().optional(),
})

// GET — listar sessões (para staff e fila)
export async function GET() {
    const session = await auth() // Verifica autenticação e obtém informações do usuário, garantindo que apenas usuários autenticados possam acessar a lista de sessões, e retornando um erro 401 Unauthorized para requisições não autenticadas.
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const sessions = await prisma.session.findMany({
        where: { status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } },
        include: {
            user: { select: { id: true, login: true, displayName: true, avatarUrl: true } },
            game: { select: { id: true, title: true, coverUrl: true } },
        },
        orderBy: { requestedAt: 'asc' },
    })

    return NextResponse.json(sessions)
}

// POST — criar nova requisição
export async function POST(request: NextRequest) {
    const session = await auth() // Verifica autenticação e obtém informações do usuário, garantindo que apenas usuários autenticados possam criar novas requisições de sessão, e retornando um erro 401 Unauthorized para requisições não autenticadas.
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // 1. Validar horário — Art. 4a
    const hoursCheck = isWithinOperatingHours()
    if (!hoursCheck.allowed) {
        return NextResponse.json({ error: hoursCheck.reason }, { status: 403 })
    }

    // 2. Verificar elegibilidade — Art. 3
    const eligibility = await checkEligibility(
        session.user.id,
        session.user.intraId,
        session.user.accessToken
    )
    if (!eligibility.isEligible) {
        return NextResponse.json({
            error: 'Não elegível para usar a PlayStation',
            criteria: eligibility.criteria,
        }, { status: 403 })
    }

    // 3. Verificar se já tem sessão activa/pendente
    const existing = await prisma.session.findFirst({
        where: {
            userId: session.user.id,
            status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
        },
    })
    if (existing) {
        return NextResponse.json({ error: 'Já tens uma sessão activa ou pendente' }, { status: 409 })
    }

    // 4. Validar body
    const body = await request.json().catch((err: unknown) => {
        console.error('Body inválido: não é um JSON válido', err)
        return {}
    })
    // O safeParse do Zod irá validar os dados e retornar um objeto com a propriedade success indicando se a validação foi bem-sucedida ou não, e em caso de falha, a propriedade error conterá detalhes sobre os erros de validação, garantindo que apenas dados válidos sejam processados para criar uma nova sessão, e retornando um erro 400 Bad Request para dados inválidos.
    const parsed = CreateSessionSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    let txResult:
        | {
              newSession: Awaited<ReturnType<typeof prisma.session.create>>
              queueSize: number
          }
        | undefined

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            txResult = await prisma.$transaction(
                async (tx) => {
                    const existing = await tx.session.findFirst({
                        where: {
                            userId: session.user.id,
                            status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
                        },
                    })

                    if (existing) {
                        throw new Error('SESSION_CONFLICT')
                    }

                    const queueCount = await tx.session.count({
                        where: { status: { in: ['PENDING', 'APPROVED'] } },
                    })

                    const newSession = await tx.session.create({
                        data: {
                            userId: session.user.id,
                            gameId: parsed.data.gameId,
                            status: 'PENDING',
                            queuePos: queueCount + 1,
                        },
                        include: {
                            user: { select: { login: true, displayName: true, avatarUrl: true } },
                            game: { select: { title: true } },
                        },
                    })

                    await tx.auditLog.create({
                        data: {
                            actorId: session.user.id,
                            action: 'SESSION_REQUESTED',
                            entityType: 'Session',
                            entityId: newSession.id,
                            afterData: {
                                status: newSession.status,
                                queuePos: newSession.queuePos,
                            },
                        },
                    })

                    return { newSession, queueSize: queueCount + 1 }
                },
                { isolationLevel: 'Serializable' }
            )
            break
        } catch (error) {
            if (error instanceof Error && error.message === 'SESSION_CONFLICT') {
                return NextResponse.json({ error: 'Já tens uma sessão activa ou pendente' }, { status: 409 })
            }

            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2034' &&
                attempt === 0
            ) {
                continue
            }

            throw error
        }
    }

    if (!txResult) {
        return NextResponse.json({ error: 'Não foi possível criar a sessão. Tenta novamente.' }, { status: 409 })
    }

    // 7. Notificar staff em tempo real
    await pusherServer.trigger(CHANNELS.STAFF, EVENTS.NEW_REQUEST, {
        session: txResult.newSession,
        queueSize: txResult.queueSize,
    })

    // 8. Actualizar fila para todos
    await pusherServer.trigger(CHANNELS.QUEUE, EVENTS.QUEUE_UPDATED, {
        position: txResult.queueSize,
        userId: session.user.id,
    })

    return NextResponse.json(txResult.newSession, { status: 201 })
}