/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF6B00', // Vibrant Orange (Target Image Accent)
          light: '#FF8533',   // Lighter Orange for hovers
          dark: '#E65A00',    // Darker Orange
        },
        // Custom Grays for Text and Backgrounds matching the image style
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6', // Main Page Background
          200: '#E5E7EB', // Borders
          300: '#D1D5DB',
          400: '#9CA3AF', // Inactive Icons/Text
          500: '#6B7280', // Subtitles / Secondary Text
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937', // Main Headings / Active Text
          900: '#111827',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Clean modern font
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', // Soft shadow for cards
      },
      borderRadius: {
        'xl': '1rem', // Softer, larger border radius for cards
        '2xl': '1.5rem',
      }
    },
  },
  plugins: [],
}