// app/(auth)/login/page.tsx
import { signInWith42 } from '@/action/auth-actions'

type LoginPageProps = {
    searchParams?: Promise<{
        error?: string | string[]
        status?: string | string[]
    }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const resolvedSearchParams = await searchParams
    const status = Array.isArray(resolvedSearchParams?.status)
        ? resolvedSearchParams.status[0]
        : resolvedSearchParams?.status

    return (
        <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg))]">
            <div className="text-center space-y-8 p-8">
                <div>
                    <h1 className="font-display text-5xl font-black tracking-tight ">
                        <span className="text-teal-400">PS42</span> Luanda
                    </h1>
                    <p className="text-[rgb(var(--muted-fg))] mt-3">
                        Zona de Descompressão · 42 Luanda
                    </p>
                </div>

                {status === 'unavailable' && (
                    <div className="mx-auto max-w-md rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        A base de dados não está disponível no momento. Por favor tenta de novo mais tarde ou contacta o administrador.
                    </div>
                )}

                {status === 'reauth' && (
                    <div className="mx-auto max-w-md rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        A tua sessão expirou. Por favor entra novamente com a conta Intra 42.
                    </div>
                )}

                <form action={signInWith42}>
                    <button
                        type="submit"
                        className="bg-teal-400 text-[rgb(var(--bg))] font-bold px-6 py-4
                       font-mono text-sm tracking-wider hover:bg-teal-300
                       transition-colors w-full max-w-xs"
                    >
                        ENTRAR COM A CONTA INTRA 42 →
                    </button>
                </form>
            </div>
        </div>
    )
}