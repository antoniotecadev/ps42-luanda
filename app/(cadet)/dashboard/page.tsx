// app/(cadete)/dashboard/page.tsx

/**
 * A página principal do cadete. 
 * Mostra estado de elegibilidade em tempo real, sessão activa, posição na fila e acção principal (pedir / ver fila).
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { checkEligibility, isWithinOperatingHours } from '@/lib/eligibility'
import { prisma } from '@/lib/prisma'
import EligibilityCard from '@/components/cadet/EligibilityCard'
import SessionCard from '@/components/cadet/SessionCard'
import QueueCard from '@/components/cadet/QueueCard'

export default async function CadeteDashboard() {
    const session = await auth()
    if (!session?.user) redirect('/login')

    // Buscar dados em paralelo
    const [eligibility, hours, mySession, queueCount] = await Promise.all([
        checkEligibility(session.user.id, session.user.intraId, session.user.accessToken),
        Promise.resolve(isWithinOperatingHours()),
        prisma.session.findFirst({
            where: { userId: session.user.id, status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } },
            include: { game: true },
        }),
        prisma.session.count({
            where: { status: { in: ['PENDING', 'APPROVED'] } },
        }),
    ])

    // console.log("AcessToken:", session.user.accessToken);
    // console.log("Intra ID:", session.user.intraId);

    return (
        <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 border border-[rgb(var(--border))] bg-surface p-6 rounded-sm">
                <p className="font-mono text-xs text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-1">
                    Bem-vindo de volta
                </p>
                <h1 className="font-display text-3xl font-black tracking-tight">
                    {session.user.name}
                    <span className="text-teal-400 ml-2 text-xl font-mono">
                        @{session.user.login}
                    </span>
                </h1>
                <p className="text-sm text-[rgb(var(--muted-fg))] mt-2">
                    Acompanhe a tua elegibilidade, estado da sessão e próximos passos num só painel.
                </p>
            </div>

            {/* Grid principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">

                {/* Card de elegibilidade */}
                <EligibilityCard
                    eligibility={eligibility}
                    hours={hours}
                    className="lg:col-span-2"
                />

                {/* Card de sessão / fila */}
                {mySession ? (
                    <SessionCard session={mySession} />
                ) : (
                    <QueueCard
                        queueCount={queueCount}
                        canRequest={eligibility.isEligible && hours.allowed}
                    />
                )}

            </div>
        </div>
    )
}