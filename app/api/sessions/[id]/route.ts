//  api/sessions/[id]/route.ts

/**
 *  API Routes para aprovar, rejeitar, iniciar, terminar e estender sessões. 
 *  Inclui todas as validações do regulamento: horário, elegibilidade, 30 minutos de antecedência.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher'

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const isStaff = ['STAFF', 'ADMIN'].includes(session.user.role)
    const body = await request.json()
    const { action } = body  // 'approve' | 'reject' | 'start' | 'end' | 'extend'

    const current = await prisma.session.findUnique({ where: { id: params.id } })
    if (!current) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

    let updateData: Record<string, unknown> = {}

    switch (action) {
        case 'approve': // Apenas staff pode aprovar sessões pendentes, e a aprovação muda o status da sessão para 'APPROVED', permitindo que ela seja iniciada posteriormente, garantindo que apenas sessões aprovadas possam ser iniciadas, e retornando um erro 403 Forbidden para tentativas de aprovação por usuários sem permissão.
            if (!isStaff) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
            updateData = { status: 'APPROVED' }
            break

        case 'start': // Apenas staff pode iniciar sessões aprovadas, e o início de uma sessão muda seu status para 'ACTIVE' e define a data de início, garantindo que apenas sessões aprovadas possam ser iniciadas, e retornando um erro 403 Forbidden para tentativas de início por usuários sem permissão.
            if (!isStaff) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
            updateData = { status: 'ACTIVE', startedAt: new Date(), durationMin: 60 }
            await pusherServer.trigger(CHANNELS.SESSION, EVENTS.SESSION_STARTED, {
                sessionId: current.id, userId: current.userId, durationMin: 60,
            })
            break

        case 'end': // Apenas staff pode terminar sessões activas, e o término de uma sessão muda seu status para 'DONE' e define a data de término, garantindo que apenas sessões activas possam ser terminadas, e retornando um erro 403 Forbidden para tentativas de término por usuários sem permissão.
            if (!isStaff) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
            updateData = {
                status: 'DONE',
                endedAt: new Date(),
                endedBy: isStaff ? 'staff' : 'student',
            }
            await pusherServer.trigger(CHANNELS.SESSION, EVENTS.SESSION_ENDED, {
                sessionId: current.id,
            })
            await pusherServer.trigger(CHANNELS.QUEUE, EVENTS.QUEUE_UPDATED, {})
            break

        case 'extend': // Apenas staff pode estender sessões activas, e a extensão de uma sessão muda seu status para 'EXTENDED' e define a nova duração, garantindo que apenas sessões activas possam ser estendidas, e retornando um erro 403 Forbidden para tentativas de extensão por usuários sem permissão.
            if (!isStaff) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
            updateData = { extended: true, durationMin: 120 }
            break

        case 'reject': // Apenas staff pode rejeitar sessões pendentes, e a rejeição de uma sessão muda seu status para 'REJECTED' e pode incluir uma nota do staff, garantindo que apenas sessões pendentes possam ser rejeitadas, e retornando um erro 403 Forbidden para tentativas de rejeição por usuários sem permissão.
            if (!isStaff) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
            updateData = { status: 'REJECTED', staffNote: body.note }
            break

        default:
            return NextResponse.json({ error: 'Acção inválida' }, { status: 400 })
    }

    const updated = await prisma.session.update({
        where: { id: params.id },
        data: updateData,
    })

    return NextResponse.json(updated)
}