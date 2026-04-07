/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0e1a',
        'bg-secondary': '#111827',
        'bg-card': '#1a2235',
        'bg-hover': '#1e2d47',
        'accent-green': '#00d09c',
        'accent-red': '#ff4757',
        'accent-yellow': '#ffd32a',
        'accent-blue': '#3498db',
        'text-primary': '#e2e8f0',
        'text-secondary': '#94a3b8',
        'border-color': '#2d3748',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
