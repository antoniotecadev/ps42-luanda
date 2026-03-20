// app/api/eligibility/route.ts

/**
 * Endpoint público (para o utilizador autenticado) que retorna o resultado detalhado da verificação de elegibilidade — critério a critério.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkEligibility, isWithinOperatingHours } from '@/lib/eligibility'

export async function GET() {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const [eligibility, hours] = await Promise.all([
        checkEligibility(session.user.id, session.user.intraId, session.user.accessToken),
        Promise.resolve(isWithinOperatingHours()),
    ])

    return NextResponse.json({
        ...eligibility, // Inclui isEligible, isBlocked e motivos detalhados
        operatingHours: hours, // Informação sobre o horário de funcionamento, para que o frontend possa mostrar mensagens específicas se estiver fora do horário
        canRequestNow: eligibility.isEligible && hours.allowed, // Indica se o usuário pode fazer uma solicitação agora, considerando tanto a elegibilidade quanto o horário de funcionamento
    })
}

// DELETE — invalidar cache (forçar re-check)
export async function DELETE() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { redis } = await import('@/lib/redis')
    await redis.del(`eligibility:${session.user.id}`)

    return NextResponse.json({ invalidated: true })
}