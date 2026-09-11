/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#070a12',
          surface: '#0d1322',
          card: 'rgba(15, 23, 42, 0.75)',
          border: 'rgba(255, 255, 255, 0.08)',
          neonGreen: '#14F195',
          neonPurple: '#9945FF',
          neonCyan: '#00e5ff',
          neonPink: '#ff2a5f',
          neonYellow: '#ffaa00',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(20, 241, 149, 0.35)',
        'glow-cyan': '0 0 20px rgba(0, 229, 255, 0.35)',
        'glow-purple': '0 0 20px rgba(153, 69, 255, 0.35)',
        'glow-pink': '0 0 20px rgba(255, 42, 95, 0.45)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
    },
  },
  plugins: [],
}
