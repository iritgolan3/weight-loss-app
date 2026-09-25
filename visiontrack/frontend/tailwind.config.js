// Allow any 1%-step opacity modifier (bg-neon/12, border-neon/45, ...).
const opacity = Object.fromEntries(
  Array.from({ length: 101 }, (_, i) => [String(i), String(i / 100)]),
)

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      opacity,
      colors: {
        ink: {
          900: '#050607',
          850: '#0a0c0e',
          800: '#0f1214',
          700: '#15191c',
          600: '#1d2226',
          500: '#272d33',
          400: '#39424a',
        },
        neon: { DEFAULT: '#39ff14', dim: '#1fa80c', soft: '#a9ffa0' },
        magenta: { DEFAULT: '#ff2bd1', dim: '#b8199a' },
        amber: { DEFAULT: '#ffb020' },
        danger: { DEFAULT: '#ff4d4d' },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 40px -24px rgba(0,0,0,0.9)',
        neon: '0 0 0 1px rgba(57,255,20,0.35), 0 0 18px -6px rgba(57,255,20,0.55)',
      },
      keyframes: {
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        sweep: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(320%)' } },
      },
      animation: {
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
        sweep: 'sweep 2.4s linear infinite',
      },
    },
  },
  plugins: [],
}
