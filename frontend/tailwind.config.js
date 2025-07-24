/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7f0',
          100: '#b3e6d4',
          200: '#80d5b8',
          300: '#4dc49c',
          400: '#26b884',
          500: '#00a666',
          600: '#009558',
          700: '#007443',
          800: '#00532f',
          900: '#00321c',
        },
        secondary: {
          50: '#e8eaf0',
          100: '#c1c6d6',
          200: '#9aa1bc',
          300: '#737da2',
          400: '#4c5888',
          500: '#1c2545',
          600: '#161d38',
          700: '#11162b',
          800: '#0b0e1e',
          900: '#060711',
        },
        uptoten: {
          green: '#00a666',
          blue: '#1c2545',
          lightGreen: '#26b884',
          darkBlue: '#11162b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}