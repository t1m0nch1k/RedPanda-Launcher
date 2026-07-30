/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        card: 'var(--color-card)',
        'card-hover': 'var(--color-card-hover)',
        primary: {
          DEFAULT: 'var(--color-primary, #F55E1D)',
          hover: 'var(--color-primary-hover, #FF6B26)'
        },
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        text: 'var(--color-text)'
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
