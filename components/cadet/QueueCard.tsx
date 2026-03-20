'use client'

import Link from 'next/link'

interface QueueCardProps {
    queueCount: number
    canRequest: boolean
}

export default function QueueCard({ queueCount, canRequest }: QueueCardProps) {
    return (
        <div className="bg-surface border border-[rgb(var(--border))] rounded-sm p-6 h-full flex flex-col">
            <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-2">
                Estado da fila
            </p>

            <p className="font-display text-4xl font-black text-teal-400 leading-none">{queueCount}</p>
            <p className="text-sm text-[rgb(var(--muted-fg))] mt-2">
                {queueCount === 0 ? 'Nenhum pedido na fila neste momento.' : `${queueCount} pedido(s) em espera.`}
            </p>

            <div className="mt-6 space-y-2">
                <Link
                    href="/queue"
                    className="w-full block text-center px-3 py-2 border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] font-mono text-xs hover:border-teal-400/40 hover:text-teal-400 transition-colors"
                >
                    VER FILA AO VIVO
                </Link>
                <Link
                    href="/request"
                    className={`w-full block text-center px-3 py-2 font-mono text-xs transition-colors ${
                        canRequest
                            ? 'bg-teal-400 text-[rgb(var(--background))] hover:bg-teal-300'
                            : 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-fg))] cursor-not-allowed pointer-events-none'
                    }`}
                >
                    {canRequest ? 'REQUISITAR SESSÃO' : 'REQUISIÇÃO INDISPONÍVEL'}
                </Link>
            </div>
        </div>
    )
}
