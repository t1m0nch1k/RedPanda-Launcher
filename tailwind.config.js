/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        card: '#141414',
        'card-hover': '#1e1e1e',
        primary: {
          DEFAULT: '#F55E1D',
          hover: '#E04F0F'
        },
        muted: '#8a8a8e',
        border: '#262626'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
