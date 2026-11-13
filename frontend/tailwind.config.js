/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'naatal-green-dark': '#123B2A',
        'naatal-green': '#21865B',
        'naatal-green-light': '#DDF3E6',
        'naatal-cream': '#F7F8F3',
        'naatal-sand': '#E9D9B7',
        'naatal-text': '#17251D',
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
