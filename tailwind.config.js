/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: {
          DEFAULT: 'rgba(15, 23, 42, 0.8)',
          border: 'rgba(255, 255, 255, 0.07)',
          hover: 'rgba(255, 255, 255, 0.04)',
        },
        brand: {
          blue: '#3b82f6',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
        },
        medal: {
          gold: '#FFD700',
          silver: '#C0C0C0',
          bronze: '#CD7F32',
        },
      },
      animation: {
        'slide-in': 'slideIn 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'count-up': 'countUp 0.3s ease-out',
        'rank-up': 'rankUp 0.5s ease-out',
        'rank-down': 'rankDown 0.5s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.7), 0 0 40px rgba(59, 130, 246, 0.3)' },
        },
        rankUp: {
          '0%': { transform: 'translateY(4px)', color: '#10b981' },
          '100%': { transform: 'translateY(0)', color: 'inherit' },
        },
        rankDown: {
          '0%': { transform: 'translateY(-4px)', color: '#ef4444' },
          '100%': { transform: 'translateY(0)', color: 'inherit' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-lg': '0 16px 64px rgba(0, 0, 0, 0.5)',
        'glow-blue': '0 0 30px rgba(59, 130, 246, 0.3)',
        'glow-green': '0 0 30px rgba(16, 185, 129, 0.3)',
        'glow-amber': '0 0 30px rgba(245, 158, 11, 0.3)',
      },
    },
  },
  plugins: [],
}
