/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        surface: '#12121a',
        surface2: '#1a1a28',
        border: '#252538',
        accent: '#7c6cff',
        accent2: '#ff6c8a',
        accent3: '#6cffd4',
        textMuted: '#7070a0',
      },
    },
  },
  plugins: [],
}
