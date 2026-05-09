/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        veyron: {
          'navy': '#02131F',
          'ocean': '#032B3A',
          'teal': '#041A22',
          'cyan': '#00E0FF',
          'aqua': '#0099CC',
          'ice': '#7DD9FF',
        },
      },
      fontFamily: {
        'grotesk': '"Space Grotesk", sans-serif',
        'satoshi': '"Satoshi", sans-serif',
        'general': '"General Sans", sans-serif',
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(135deg, #02131F 0%, #032B3A 50%, #041A22 100%)',
        'ocean-glow': 'radial-gradient(circle at center, rgba(0, 224, 255, 0.15) 0%, transparent 70%)',
        'neon-glow': 'radial-gradient(circle at center, rgba(0, 224, 255, 0.3) 0%, transparent 60%)',
      },
      boxShadow: {
        'cyber-sm': '0 4px 12px rgba(0, 224, 255, 0.08)',
        'cyber': '0 8px 24px rgba(0, 224, 255, 0.12)',
        'cyber-lg': '0 16px 40px rgba(0, 224, 255, 0.15)',
        'cyber-xl': '0 24px 64px rgba(0, 224, 255, 0.2)',
        'glow-sm': '0 0 8px rgba(0, 224, 255, 0.4)',
        'glow': '0 0 16px rgba(0, 224, 255, 0.6)',
        'glow-lg': '0 0 24px rgba(0, 224, 255, 0.8)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-slower': 'float 10s ease-in-out infinite',
        'scan-pulse': 'scan-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'cyber-flicker': 'cyber-flicker 0.15s infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'orbit': 'orbit 20s linear infinite',
        'shimmer': 'shimmer 8s infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0, 224, 255, 0.4)', opacity: '1' },
          '50%': { boxShadow: '0 0 24px rgba(0, 224, 255, 0.8)', opacity: '0.8' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'scan-pulse': {
          '0%': { transform: 'scaleY(1)', opacity: '1' },
          '50%': { opacity: '0.5' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
        'cyber-flicker': {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.8' },
          '100%': { opacity: '1' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        'orbit': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'smooth-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.backdrop-blur-xl': {
          backdropFilter: 'blur(20px)',
        },
        '.glass': {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.glass-dark': {
          background: 'rgba(2, 19, 31, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 224, 255, 0.1)',
        },
        '.text-glow': {
          textShadow: '0 0 16px rgba(0, 224, 255, 0.4)',
        },
        '.text-glow-strong': {
          textShadow: '0 0 24px rgba(0, 224, 255, 0.6)',
        },
      });
    },
  ],
};
