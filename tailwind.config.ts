import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: 'class',
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['DM Sans', 'sans-serif'],
                display: ['Syne', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                teal: {
                    DEFAULT: 'rgb(var(--teal) / <alpha-value>)',
                    dim: 'rgb(var(--teal-dim))',
                },
                surface: {
                    DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
                    2: 'rgb(var(--surface-2) / <alpha-value>)',
                    3: 'rgb(var(--surface-3) / <alpha-value>)',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
        },
    },
    // plugins: [require('tailwindcss-animate')],
}

export default config