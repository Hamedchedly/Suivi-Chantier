/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0b3b60',
          light: '#185FA5',
          lighter: '#e6f1fb',
        },
        slate: {
          600: '#5c6f80',
          700: '#16222e',
        },
      },
    },
  },
  plugins: [],
}
