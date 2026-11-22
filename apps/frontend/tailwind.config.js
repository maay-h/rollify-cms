/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rollify: {
          red: {
            DEFAULT: '#C8102E',
            50: '#FDF2F3',
            100: '#FCE7EA',
            200: '#FACFD5',
            300: '#F5A3AE',
            400: '#E0475E',
            500: '#C8102E', // Brand Core Red
            600: '#A80D26',
            700: '#870A1E',
            800: '#670817',
            900: '#4D0611',
          },
          gold: {
            DEFAULT: '#F59E0B',
            50: '#FFFBEB',
            100: '#FEF3C7',
            200: '#FDE68A',
            300: '#FCD34D',
            400: '#FBBF24',
            500: '#F59E0B', // Brand Gold Accent
            600: '#D97706',
            700: '#B45309',
            800: '#92400E',
            900: '#78350F',
          },
          cream: {
            DEFAULT: '#FFFDF9',
            50: '#FFFFFF',
            100: '#FFFDF9', // Core warm cream
            200: '#FEF9EE',
            300: '#FDF3DC',
            400: '#FCEBC8',
            500: '#F8DFA7',
          },
          charcoal: {
            DEFAULT: '#18181B',
            50: '#F4F4F5',
            100: '#E4E4E7',
            200: '#D4D4D8',
            300: '#A1A1AA',
            400: '#71717A',
            500: '#52525B',
            600: '#3F3F46',
            700: '#27272A',
            800: '#1F1F23',
            900: '#18181B', // Core Charcoal
            950: '#0F0F11',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
