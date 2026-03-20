'use client'

import Link from 'next/link'

interface SessionCardProps {
    session: {
        id: string
        status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'DONE' | 'REJECTED' | 'CANCELLED'
        requestedAt: Date
        startedAt?: Date | null
        durationMin?: number | null
        queuePos?: number | null
        game?: { title?: string | null } | null
    }
}

const STATUS_LABEL: Record<SessionCardProps['session']['status'], string> = {
    PENDING: 'Pendente',
    APPROVED: 'Aprovada',
    ACTIVE: 'Activa',
    DONE: 'Concluída',
    REJECTED: 'Rejeitada',
    CANCELLED: 'Cancelada',
}

const STATUS_COLOR: Record<SessionCardProps['session']['status'], string> = {
    PENDING: 'text-orange-400',
    APPROVED: 'text-blue-400',
    ACTIVE: 'text-green-400',
    DONE: 'text-[rgb(var(--muted-fg))]',
    REJECTED: 'text-red-400',
    CANCELLED: 'text-[rgb(var(--muted-fg))]',
}

export default function SessionCard({ session }: SessionCardProps) {
    return (
        <div className="bg-surface border border-[rgb(var(--border))] rounded-sm p-6 h-full">
            <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-2">
                A tua sessão
            </p>

            <div className="flex items-center justify-between mb-4">
                <p className="font-display text-xl font-black">{session.game?.title || 'Sessão sem jogo definido'}</p>
                <span className={`font-mono text-xs ${STATUS_COLOR[session.status]}`}>
                    {STATUS_LABEL[session.status]}
                </span>
            </div>

            <div className="space-y-2 mb-6">
                <p className="text-sm text-[rgb(var(--muted-fg))]">
                    Pedido feito às {new Date(session.requestedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {session.queuePos ? (
                    <p className="text-sm text-[rgb(var(--muted-fg))]">Posição atual na fila: #{session.queuePos}</p>
                ) : null}
                {session.status === 'ACTIVE' && session.durationMin ? (
                    <p className="text-sm text-teal-400">Tempo da sessão: {session.durationMin} min</p>
                ) : null}
            </div>

            <div className="flex gap-2">
                <Link
                    href="/queue"
                    className="flex-1 text-center px-3 py-2 border border-teal-400/30 bg-teal-400/10 text-teal-400 font-mono text-xs hover:bg-teal-400/20 transition-colors"
                >
                    VER FILA AO VIVO
                </Link>
            </div>
        </div>
    )
}
