/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#020510',
          900: '#05091a',
          800: '#0a1128',
          700: '#0d1631',
          600: '#111e3d',
        },
        cyan: { DEFAULT: '#00e5ff' },
        neon: { green: '#00ff87', orange: '#ff6b35', purple: '#a78bfa' },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Syne', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          from: { boxShadow: '0 0 10px #00e5ff40' },
          to: { boxShadow: '0 0 25px #00e5ff80, 0 0 50px #00e5ff20' },
        },
      },
    },
  },
  plugins: [],
}
