'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Game } from '@prisma/client'

interface Props { games: Game[] }

export default function RequisicaoForm({ games }: Props) {
    const router = useRouter()
    const [gameId, setGameId] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit() {
        setLoading(true); setError('')

        const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId: gameId || undefined }),
        })

        if (res.ok) {
            router.push('/queue')
        } else {
            const data = await res.json()
            setError(data.error || 'Erro ao submeter pedido')
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Seleccionar jogo */}
            <div>
                <label className="block font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-3">
                    Jogo (opcional)
                </label>
                <select
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value)}
                    className="w-full bg-surface-2 border border-[rgb(var(--border))]
                     text-sm p-3 font-mono text-[rgb(var(--fg))]
                     focus:border-teal-400 focus:outline-none"
                >
                    <option value="">Sem preferência</option>
                    {games.map(g => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                </select>
            </div>

            {/* Nota regulamentar */}
            <div className="border border-[rgb(var(--border))] p-4 text-xs text-[rgb(var(--muted-fg))] font-mono space-y-1">
                <p>→ Deves levantar a consola na recepção com o teu ID. (Art. 4g)</p>
                <p>→ Tempo máximo de sessão: 1 hora. (Art. 4f)</p>
                <p>→ Devolve a consola em perfeitas condições. (Art. 4h)</p>
            </div>

            {error && (
                <p className="text-red-400 text-sm font-mono">{error}</p>
            )}

            <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-teal-400 text-[rgb(var(--bg))] font-bold
                   font-mono text-sm py-4 tracking-wider
                   hover:bg-teal-300 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'A SUBMETER...' : 'SUBMETER PEDIDO →'}
            </button>
        </div>
    )
}