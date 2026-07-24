/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0B1220',
          800: '#111C30',
          700: '#182338',
          600: '#243350'
        },
        canvas: '#F5F6F8',
        ledger: {
          teal: '#0F766E',
          tealLight: '#CCFBF1',
          rose: '#BE123C',
          roseLight: '#FFE4E6',
          amber: '#B45309',
          amberLight: '#FEF3C7'
        }
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)'
      }
    }
  },
  plugins: []
};
