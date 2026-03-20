// app/(staff)/staff/dashboard/page.tsx

/**
 * Centro de controlo operacional. Vê a fila em tempo real, 
 * a sessão activa, alertas de novos pedidos e métricas do dia.
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import StaffQueuePanel from '@/components/staff/StaffQueuePanel'

export default async function StaffDashboard() {
    const session = await auth();

    if (!session?.user) redirect('/login')
    if (!['STAFF', 'ADMIN'].includes(session.user.role)) redirect('/dashboard')

    // Métricas do dia
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [totalToday, activeNow, pendingCount, reportsOpen] = await Promise.all([
        prisma.session.count({ where: { requestedAt: { gte: today } } }),
        prisma.session.count({ where: { status: 'ACTIVE' } }),
        prisma.session.count({ where: { status: 'PENDING' } }),
        prisma.report.count({ where: { status: 'OPEN' } }),
    ])

    return (
        <div className="min-h-screen p-6 md:p-10">
            <div className="mb-8">
                <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-1">
                    Centro de Controlo
                </p>
                <h1 className="font-display text-3xl font-black tracking-tight">
                    Dashboard Staff
                </h1>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
                {[
                    { label: 'Sessões hoje', value: totalToday, color: 'text-teal-400' },
                    { label: 'Activas agora', value: activeNow, color: 'text-green-400' },
                    { label: 'Pendentes', value: pendingCount, color: 'text-orange-400' },
                    { label: 'Denúncias abertas', value: reportsOpen, color: 'text-red-400' },
                ].map(m => (
                    <div key={m.label} className="bg-surface border border-[rgb(var(--border))] p-4">
                        <p className={`font-display text-4xl font-black ${m.color}`}>{m.value}</p>
                        <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-wider uppercase mt-1">
                            {m.label}
                        </p>
                    </div>
                ))}
            </div>

            {/* Fila em tempo real */}
            <StaffQueuePanel />
        </div>
    )
}