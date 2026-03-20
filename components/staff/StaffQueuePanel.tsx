// components/staff/StaffQueuePanel.tsx

/**
 * Painel do staff para aprovar, rejeitar, 
 * iniciar e terminar sessões. Com actualizações em tempo real via Pusher.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { pusherClient, CHANNELS, EVENTS } from '@/lib/pusher'

type Action = 'approve' | 'reject' | 'start' | 'end' | 'extend'

export default function StaffQueuePanel() {
    const [sessions, setSessions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchSessions = useCallback(async () => {
        const res = await fetch('/api/sessions')
        if (res.ok) setSessions(await res.json())
        setLoading(false)
    }, [])

    async function doAction(sessionId: string, action: Action, note?: string) {
        await fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, note }),
        })
        fetchSessions()
    }

    useEffect(() => {
        fetchSessions()
        const ch = pusherClient.subscribe(CHANNELS.STAFF)
        ch.bind(EVENTS.NEW_REQUEST, fetchSessions)
        const qCh = pusherClient.subscribe(CHANNELS.QUEUE)
        qCh.bind(EVENTS.QUEUE_UPDATED, fetchSessions)
        return () => {
            pusherClient.unsubscribe(CHANNELS.STAFF)
            pusherClient.unsubscribe(CHANNELS.QUEUE)
        }
    }, [fetchSessions])

    const STATUS_LABEL: Record<string, string> = {
        PENDING: 'Pendente', APPROVED: 'Aprovado',
        ACTIVE: 'Activo', DONE: 'Concluído', REJECTED: 'Rejeitado',
    }
    const STATUS_COLOR: Record<string, string> = {
        PENDING: 'text-orange-400', APPROVED: 'text-blue-400',
        ACTIVE: 'text-green-400', DONE: 'text-[rgb(var(--muted-fg))]',
        REJECTED: 'text-red-400',
    }

    if (loading) return <div className="font-mono text-sm text-[rgb(var(--muted-fg))] animate-pulse">A carregar...</div>

    return (
        <div>
            <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-4">
                Fila em Tempo Real ({sessions.length})
            </p>

            {sessions.length === 0 ? (
                <div className="border border-[rgb(var(--border))] p-8 text-center">
                    <p className="text-[rgb(var(--muted-fg))] font-mono text-sm">Sem pedidos activos</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sessions.map((s) => (
                        <div key={s.id} className="border border-[rgb(var(--border))] bg-surface p-4 rounded-sm">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                    <p className="font-medium">{s.user?.displayName}</p>
                                    <p className="font-mono text-xs text-[rgb(var(--muted-fg))]">
                                        @{s.user?.login} · {s.game?.title || 'Sem jogo'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-mono text-xs ${STATUS_COLOR[s.status]}`}>
                                        {STATUS_LABEL[s.status]}
                                    </span>

                                    {s.status === 'PENDING' && (<>
                                        <button onClick={() => doAction(s.id, 'approve')}
                                            className="px-3 py-1 bg-teal-400/10 border border-teal-400/30 text-teal-400 font-mono text-xs hover:bg-teal-400/20">
                                            Aprovar
                                        </button>
                                        <button onClick={() => doAction(s.id, 'reject')}
                                            className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs hover:bg-red-500/20">
                                            Rejeitar
                                        </button>
                                    </>)}

                                    {s.status === 'APPROVED' && (
                                        <button onClick={() => doAction(s.id, 'start')}
                                            className="px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 font-mono text-xs hover:bg-green-500/20">
                                            Iniciar Sessão
                                        </button>
                                    )}

                                    {s.status === 'ACTIVE' && (<>
                                        <button onClick={() => doAction(s.id, 'extend')}
                                            className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-xs">
                                            +60 min
                                        </button>
                                        <button onClick={() => doAction(s.id, 'end')}
                                            className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs">
                                            Terminar
                                        </button>
                                    </>)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}