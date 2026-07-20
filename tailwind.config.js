/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#101214',
        card: '#16181a',
        'card-hover': '#1e2124',
        primary: {
          DEFAULT: '#F55E1D',
          hover: '#FF6B26'
        },
        muted: '#8a8a8e',
        border: '#2a2d30'
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
