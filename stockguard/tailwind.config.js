/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b0c14',
          2: '#10111f',
          3: '#181928',
          4: '#1e1f32',
        },
        store: {
          a1:  '#5ba3f5',
          jti: '#a78bfa',
          a10: '#fb923c',
        },
      },
    },
  },
  plugins: [],
}
