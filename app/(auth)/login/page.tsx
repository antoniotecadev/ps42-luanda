// app/(auth)/login/page.tsx
import { signInWith42 } from '@/action/auth-actions'
export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg))]">
            <div className="text-center space-y-8 p-8">
                <div>
                    <h1 className="font-display text-5xl font-black text-white tracking-tight">
                        <span className="text-teal-400">PS42</span> Luanda
                    </h1>
                    <p className="text-[rgb(var(--muted-fg))] mt-3">
                        Zona de Descompressão · 42 Luanda
                    </p>
                </div>

                <form action={signInWith42}>
                    <button
                        type="submit"
                        className="bg-teal-400 text-[rgb(var(--bg))] font-bold px-8 py-4
                       font-mono text-sm tracking-wider hover:bg-teal-300
                       transition-colors w-full max-w-xs"
                    >
                        ENTRAR COM A CONTA 42 →
                    </button>
                </form>
            </div>
        </div>
    )
}