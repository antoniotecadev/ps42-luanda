// app/(cadete)/dashboard/page.tsx

/**
 * A página principal do cadete. 
 * Mostra estado de elegibilidade em tempo real, sessão activa, posição na fila e acção principal (pedir / ver fila).
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkEligibility, isWithinOperatingHours } from '@/lib/eligibility'
import { prisma } from '@/lib/prisma'
import EligibilityCard from '@/components/cadet/EligibilityCard'
import SessionCard from '@/components/cadet/SessionCard'
import QueueCard from '@/components/cadet/QueueCard'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

export default async function CadeteDashboard() {
    const session = await auth()
    if (!session?.user) redirect('/login')

    // Buscar dados em paralelo
    const [eligibility, hours, mySession, queueCount, dbUser] = await Promise.all([
        checkEligibility(session.user.id, session.user.intraId, session.user.accessToken),
        Promise.resolve(isWithinOperatingHours()),
        prisma.session.findFirst({
            where: { userId: session.user.id, status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } },
            include: { game: true },
        }),
        prisma.session.count({
            where: { status: { in: ['PENDING', 'APPROVED'] } },
        }),
        prisma.user.findUnique({ where: { id: session.user.id }, select: { avatarUrl: true } }),
    ])

    const canRequest = eligibility.isEligible && hours.allowed

    // console.log("AcessToken:", session.user.accessToken);
    // console.log("Intra ID:", session.user.intraId);

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-10 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 border border-[rgb(var(--border))] bg-surface p-5 sm:p-6 rounded-sm shadow-sm">
                <div className="flex items-center gap-3 sm:gap-4">
                    <Avatar size="lg">
                        {dbUser?.avatarUrl ? (
                            <AvatarImage src={dbUser.avatarUrl} alt={session.user.name ?? session.user.login} />
                        ) : session.user.image ? (
                            <AvatarImage src={session.user.image as string} alt={session.user.name ?? session.user.login} />
                        ) : (
                            <AvatarFallback>{(session.user.name || session.user.login || 'U')[0]}</AvatarFallback>
                        )}
                    </Avatar>
                    <div>
                        <p className="font-mono text-[10px] sm:text-xs text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-1">Bem-vindo de volta</p>
                        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight">
                            {session.user.name}
                            <span className="text-teal-400 ml-2 text-base sm:text-xl font-mono">@{session.user.login}</span>
                        </h1>
                    </div>
                </div>
                <p className="text-xs sm:text-sm text-[rgb(var(--muted-fg))] mt-2">
                    Acompanhe a tua elegibilidade, estado da sessão e próximos passos num só painel.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${canRequest ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${canRequest ? 'bg-green-400' : 'bg-amber-400'}`} />
                        {canRequest ? 'Pedido disponível' : 'Pedido indisponível'}
                    </span>
                    <span className="inline-flex items-center border border-[rgb(var(--border))] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[rgb(var(--muted-fg))]">
                        Fila actual: {queueCount}
                    </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link
                        href={mySession ? '/queue' : '/request'}
                        className={`w-full text-center px-4 py-3 font-mono text-xs tracking-wide transition-colors rounded-sm ${canRequest || mySession ? 'bg-teal-400 text-[rgb(var(--background))] hover:bg-teal-300 font-bold' : 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-fg))] cursor-not-allowed pointer-events-none'}`}
                    >
                        {mySession ? 'VER MINHA SESSÃO' : 'REQUISITAR SESSÃO'}
                    </Link>
                    <Link
                        href="/queue"
                        className="w-full text-center px-4 py-3 border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] font-mono text-xs tracking-wide hover:border-teal-400/40 hover:text-teal-400 transition-colors rounded-sm"
                    >
                        VER FILA AO VIVO
                    </Link>
                </div>
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
                        canRequest={canRequest}
                    />
                )}

            </div>
        </div>
    )
}