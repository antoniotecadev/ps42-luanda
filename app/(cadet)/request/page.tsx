// app/(cadete)/requisicao/page.tsx

/**
 * Página onde o cadete faz o pedido de sessão. 
 * Valida elegibilidade antes de mostrar o formulário, lista jogos aprovados e submete para a API.
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { checkEligibility, isWithinOperatingHours } from '@/lib/eligibility'
import { prisma } from '@/lib/prisma'
import RequisicaoForm from '@/components/cadet/RequisicaoForm'

export default async function RequisicaoPage() {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const [eligibility, hours, games, myPending] = await Promise.all([
        checkEligibility(session.user.id, session.user.intraId, session.user.accessToken),
        Promise.resolve(isWithinOperatingHours()),
        prisma.game.findMany({ where: { isApproved: true }, orderBy: { title: 'asc' } }),
        prisma.session.findFirst({
            where: { userId: session.user.id, status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } },
        }),
    ])

    // Se já tem sessão activa, redireciona para a fila
    if (myPending) redirect('/queue')

    const canRequest = eligibility.isEligible && hours.allowed

    return (
        <div className="min-h-screen p-6 md:p-10 max-w-2xl">
            <div className="mb-8">
                <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-1">
                    Artigo 5.º — Processo de Pedido
                </p>
                <h1 className="font-display text-3xl font-black tracking-tight">
                    Requisitar Sessão
                </h1>
                <p className="text-[rgb(var(--muted-fg))] mt-2 text-sm">
                    O pedido deve ser feito com mínimo 30 minutos de antecedência. (Art. 4c)
                </p>
            </div>

            {!canRequest ? (
                <div className="border border-red-500/30 bg-red-500/5 p-6 rounded-sm">
                    <p className="text-red-400 font-mono text-sm">
                        {!hours.allowed ? hours.reason : 'Não elegível para requisitar sessão. Verifica os critérios no teu dashboard.'}
                    </p>
                </div>
            ) : (
                <RequisicaoForm games={games} />
            )}
        </div>
    )
}