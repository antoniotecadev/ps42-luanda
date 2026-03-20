// components/cadete/EligibilityCard.tsx

'use client'

import type { EligibilityResult } from '@/lib/eligibility'

interface Props {
    eligibility: EligibilityResult
    hours: { allowed: boolean; reason?: string }
    className?: string
}

export default function EligibilityCard({ eligibility, hours, className }: Props) {
    const { isEligible, criteria } = eligibility
    const failedCount = criteria.filter(c => !c.passed).length

    return (
        <div className={`bg-surface border border-[rgb(var(--border))] rounded-sm p-6 h-full ${className}`}>
            {/* Status principal */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-1">
                        Estado de Acesso
                    </p>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isEligible ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                        <span className={`font-display text-xl font-bold ${isEligible ? 'text-green-400' : 'text-red-400'}`}>
                            {isEligible ? 'ELEGÍVEL' : 'NÃO ELEGÍVEL'}
                        </span>
                    </div>
                </div>

                {/* Horário */}
                <div className="text-right">
                    <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-1">
                        Horário
                    </p>
                    <span className={`font-mono text-sm ${hours.allowed ? 'text-green-400' : 'text-orange-400'}`}>
                        {hours.allowed ? 'Em funcionamento' : 'Fora de horário'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="border border-[rgb(var(--border))] p-3 rounded-sm">
                    <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] uppercase tracking-widest">Critérios OK</p>
                    <p className="font-display text-2xl font-black text-green-400">{criteria.length - failedCount}</p>
                </div>
                <div className="border border-[rgb(var(--border))] p-3 rounded-sm">
                    <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] uppercase tracking-widest">Pendentes</p>
                    <p className="font-display text-2xl font-black text-red-400">{failedCount}</p>
                </div>
            </div>

            {/* Critérios — Art. 3 */}
            <div className="grid grid-cols-2 gap-2">
                {criteria.map((c) => (
                    <div
                        key={c.id}
                        className={`flex items-start gap-2 p-3 rounded-sm border text-xs
              ${c.passed
                                ? 'border-green-500/20 bg-green-500/5'
                                : 'border-red-500/20 bg-red-500/5'
                            }`}
                    >
                        <span className="text-base leading-none">{c.passed ? '✓' : '✗'}</span>
                        <div>
                            <p className={`font-medium ${c.passed ? 'text-green-300' : 'text-red-300'}`}>
                                {c.label}
                            </p>
                            <p className="text-[rgb(var(--muted-fg))] font-mono text-[10px] mt-0.5">
                                {c.article}
                            </p>
                            {!c.passed && c.reason && (
                                <p className="text-red-400/80 mt-1 text-[10px]">{c.reason}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}