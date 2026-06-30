/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F7F3EE', // warm cream — background
        espresso: '#2C1F1A', // deep espresso — primary dark
        gold: '#B8936A', // warm gold — accent
        'gold-soft': '#D9C3A9',
        'espresso-soft': '#5A4A40',
      },
      fontFamily: {
        heading: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: [
          'Inter',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 4px 24px rgba(44, 31, 26, 0.06)',
        card: '0 2px 16px rgba(44, 31, 26, 0.08)',
      },
    },
  },
  plugins: [],
}
