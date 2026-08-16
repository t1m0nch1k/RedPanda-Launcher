/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0c0d0e',
        card: '#141618',
        'card-hover': '#1a1c1e',
        border: '#26292d',
        primary: '#F55E1D',
        'primary-hover': '#e04f12',
        text: '#ffffff',
        muted: '#8e939c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
