/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        surface: '#0f1117',
        card: '#181a23',
        'card-hover': '#1e2130',
        'card-border': '#262938',
        subtle: '#2a2d3e',
        muted: '#6b7194',
        accent: '#22c55e',
        'accent-dim': 'rgba(34,197,94,0.12)',
        coral: '#f87171',
        'coral-dim': 'rgba(248,113,113,0.12)',
        amber: '#fbbf24',
        'amber-dim': 'rgba(251,191,36,0.12)',
        sky: '#38bdf8',
        'sky-dim': 'rgba(56,189,248,0.12)',
        violet: '#a78bfa',
        'violet-dim': 'rgba(167,139,250,0.12)',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
