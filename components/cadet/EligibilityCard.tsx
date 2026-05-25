// components/cadete/EligibilityCard.tsx

import type { EligibilityResult } from '@/lib/eligibility'

interface Props {
    eligibility: EligibilityResult
    hours: { allowed: boolean; reason?: string }
    className?: string
}

export default function EligibilityCard({ eligibility, hours, className }: Props) {
    const { isEligible, criteria } = eligibility
    const failedCount = criteria.filter(c => !c.passed).length
    const availableNow = isEligible && hours.allowed

    return (
        <div className={`bg-surface border border-[rgb(var(--border))] rounded-sm p-5 sm:p-6 h-full shadow-sm ${className}`}>
            {/* Status principal */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-1">
                        Estado de Acesso
                    </p>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isEligible ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                        <span className={`font-display text-xl font-bold ${availableNow ? 'text-green-400' : 'text-amber-300'}`}>
                            {availableNow ? 'PRONTO PARA PEDIR' : 'BLOQUEADO AGORA'}
                        </span>
                    </div>
                </div>

                {/* Horário */}
                <div className="sm:text-right">
                    <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] tracking-widest uppercase mb-1">
                        Horário (Art. 4a — Seg a Sex: 08h às 17h)
                    </p>
                    <span className={`font-mono text-sm ${hours.allowed ? 'text-green-400' : 'text-amber-400'}`}>
                        {hours.allowed ? 'Em funcionamento' : 'Fora de horário'}
                    </span>
                </div>
            </div>

            {!hours.allowed && hours.reason ? (
                <div className="mb-4 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <p className="text-[11px] font-mono text-amber-200">{hours.reason}</p>
                </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="border border-green-500/20 bg-green-500/5 p-3 rounded-sm">
                    <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] uppercase tracking-widest">Critérios OK</p>
                    <p className="font-display text-2xl font-black text-green-400">{criteria.length - failedCount}</p>
                </div>
                <div className="border border-red-500/20 bg-red-500/5 p-3 rounded-sm">
                    <p className="font-mono text-[10px] text-[rgb(var(--muted-fg))] uppercase tracking-widest">Pendentes</p>
                    <p className="font-display text-2xl font-black text-red-400">{failedCount}</p>
                </div>
            </div>

            {/* Critérios — Art. 3 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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