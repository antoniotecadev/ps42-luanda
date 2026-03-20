// components/cadete/QueueLive.tsx

/**
 * Componente client que usa Pusher para actualizar a fila automaticamente, 
 * mostrar o timer da sessão activa e notificar quando é a vez do cadete.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { pusherClient, CHANNELS, EVENTS } from '@/lib/pusher'

interface QueueState {
    activeSession: any | null
    queue: any[]
    myPosition: number | null
    estimatedWaitMin: number
    consoleStatus: 'free' | 'occupied' | 'queued'
}

export default function QueueLive({ userId }: { userId: string }) {
    const [state, setState] = useState<QueueState | null>(null)
    const [timer, setTimer] = useState(0)   // segundos restantes
    const [loading, setLoading] = useState(true)

    const fetchQueue = useCallback(async () => {
        const res = await fetch('/api/queue')
        if (res.ok) {
            const data = await res.json()
            setState(data)
            // Inicializar timer se há sessão activa
            if (data.activeSession?.startedAt) {
                const elapsed = (Date.now() - new Date(data.activeSession.startedAt).getTime()) / 1000
                const total = (data.activeSession.durationMin || 60) * 60
                setTimer(Math.max(0, total - elapsed))
            }
        }
        setLoading(false)
    }, [])

    // Fetch inicial e subscrição Pusher
    useEffect(() => {
        fetchQueue()

        const channel = pusherClient.subscribe(CHANNELS.QUEUE)
        channel.bind(EVENTS.QUEUE_UPDATED, () => fetchQueue())
        channel.bind(EVENTS.SESSION_STARTED, () => fetchQueue())
        channel.bind(EVENTS.SESSION_ENDED, () => fetchQueue())

        return () => pusherClient.unsubscribe(CHANNELS.QUEUE)
    }, [fetchQueue])

    // Timer countdown
    useEffect(() => {
        if (timer <= 0) return
        const interval = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000)
        return () => clearInterval(interval)
    }, [timer])

    const fmt = (s: number) => {
        const m = Math.floor(s / 60)
        const sec = Math.floor(s % 60)
        return `${m}:${sec.toString().padStart(2, '0')}`
    }

    if (loading) return (
        <div className="flex items-center justify-center h-48">
            <div className="font-mono text-sm text-[rgb(var(--muted-fg))] animate-pulse">
                A carregar fila...
            </div>
        </div>
    )

    return (
        <div className="space-y-6">

            {/* Sessão Activa */}
            {state?.activeSession ? (
                <div className="border border-teal-500/30 bg-teal-500/5 p-6 rounded-sm">
                    <p className="font-mono text-[10px] text-teal-400 tracking-widest uppercase mb-2">
                        Sessão Activa
                    </p>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-display text-lg font-bold">
                                {state.activeSession.user?.displayName}
                            </p>
                            <p className="text-sm text-[rgb(var(--muted-fg))]">
                                {state.activeSession.game?.title || 'Jogo não especificado'}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="font-mono text-3xl font-bold text-teal-400">
                                {fmt(timer)}
                            </p>
                            <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))]">RESTANTE</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="border border-green-500/30 bg-green-500/5 p-6 rounded-sm text-center">
                    <p className="font-display text-lg font-bold text-green-400">
                        Consola Disponível
                    </p>
                </div>
            )}

            {/* Fila de espera */}
            <div>
                <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-3">
                    Fila de Espera ({state?.queue.length || 0})
                </p>
                {state?.queue.length === 0 ? (
                    <p className="text-[rgb(var(--muted-fg))] text-sm font-mono">Fila vazia</p>
                ) : (
                    <div className="space-y-2">
                        {state?.queue.map((s, i) => (
                            <div
                                key={s.id}
                                className={`flex items-center gap-4 p-3 border rounded-sm
                  ${s.userId === userId
                                        ? 'border-teal-500/40 bg-teal-500/5'
                                        : 'border-[rgb(var(--border))] bg-surface'
                                    }`}
                            >
                                <span className="font-mono text-sm font-bold text-[rgb(var(--muted-fg))] w-6">
                                    {i + 1}
                                </span>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{s.user?.displayName}</p>
                                    <p className="text-xs text-[rgb(var(--muted-fg))] font-mono">@{s.user?.login}</p>
                                </div>
                                {s.userId === userId && (
                                    <span className="text-xs font-mono text-teal-400">← Tu</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}