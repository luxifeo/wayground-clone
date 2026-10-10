/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        game: ['Quicksand', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: { 50: '#fdf0f7', 100: '#fbe0ef', 200: '#f7c0de', 400: '#ee4f9c', 500: '#e8237d', 600: '#d1166d', 700: '#ad0f59' },
        violet: { 450: '#8854c0' },
        game: { 900: '#2a0a24', 800: '#3d0f35', 700: '#4f1446', 600: '#6b1658' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)' },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-8px)' }, '75%': { transform: 'translateX(8px)' } },
      },
      animation: { pop: 'pop .35s ease-out both', rise: 'rise .3s ease-out both', float: 'float 3s ease-in-out infinite', shake: 'shake .35s ease-in-out' },
    },
  },
  plugins: [],
};
