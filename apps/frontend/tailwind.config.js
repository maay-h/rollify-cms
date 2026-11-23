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
            DEFAULT: '#2D1810', // Updated to Deep Espresso Coffee Brown
            50: '#FAF7F2',
            100: '#F5EBE1',
            200: '#EBDCCE',
            300: '#D7CCC8',
            400: '#8D6E63',
            500: '#4E342E',
            600: '#3E2723',
            700: '#2D1810', // Deep Coffee Brown
            800: '#24140D',
            900: '#1A0E09',
          },
          gold: {
            DEFAULT: '#EA580C', // Warm Subtle Orange
            50: '#FFF7ED',
            100: '#FFEDD5',
            200: '#FED7AA',
            300: '#FDBA74',
            400: '#FB923C',
            500: '#F97316',
            600: '#EA580C', // Warm Orange Accent
            700: '#C2410C',
            800: '#9A3412',
            900: '#7C2D12',
          },
          cream: {
            DEFAULT: '#FAF7F2',
            50: '#FFFFFF',
            100: '#FAF7F2', // Warm Cafe Cream
            200: '#F5EBE1',
            300: '#EBDCCE',
            400: '#E3CEBD',
            500: '#D5BDA6',
          },
          charcoal: {
            DEFAULT: '#2D1810',
            50: '#F9F8F6',
            100: '#F0ECE8',
            200: '#E2DBD5',
            300: '#C5B9B0',
            400: '#8C7D73',
            500: '#5C5047',
            600: '#4A3E36',
            700: '#3B3029',
            800: '#2F251F',
            900: '#2D1810', // Dark Coffee Charcoal
            950: '#1A0E09',
          }
        },
        cafe: {
          espresso: '#2D1810',
          roast: '#3E2723',
          mocha: '#4E342E',
          caramel: '#795548',
          latte: '#A1887F',
          foam: '#D7CCC8',
          cream: '#FAF7F2',
          warm: '#F5EBE1',
          orange: '#EA580C',
          amber: '#D97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
