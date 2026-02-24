/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: {
            primary: '#0D0D0D',
            secondary: '#1A1A1A',
            tertiary: '#262626',
          },
          surface: '#2D2D2D',
          border: '#3D3D3D',
        },
        light: {
          bg: {
            primary: '#FFFFFF',
            secondary: '#F5F5F5',
            tertiary: '#EBEBEB',
          },
          surface: '#FFFFFF',
          border: '#E0E0E0',
        },
        accent: {
          primary: '#E53935',
          hover: '#FF5252',
          muted: '#8B2320',
          light: '#D32F2F',
        },
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
      },
      borderRadius: {
        'btn': '6px',
        'card': '8px',
        'input': '4px',
      },
      transitionDuration: {
        'hover': '150ms',
      },
    },
  },
  plugins: [],
}
