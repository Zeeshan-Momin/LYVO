/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        acid: {
          DEFAULT: "rgb(var(--color-acid-rgb) / <alpha-value>)",
          50: "rgb(var(--color-acid-50-rgb) / <alpha-value>)"
        },
        fire: { DEFAULT: "#FF3A1A" },
        gold: { DEFAULT: "#FFD166" },
        // Theme-aware surfaces — driven by CSS variables that flip
        // between dark/light values in index.css. Same class names
        // (bg-dark-900, text-white, etc.) keep working everywhere.
        dark: {
          900: "var(--surface-900)",
          800: "var(--surface-800)",
          700: "var(--surface-700)",
          600: "var(--surface-600)",
          500: "var(--surface-500)",
        },
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        display: ["Bebas Neue", "Impact", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn .4s ease forwards",
        "slide-up": "slideUp .5s cubic-bezier(.16,1,.3,1) forwards",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(24px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
      boxShadow: {
        acid: "0 0 24px rgb(var(--color-acid-rgb) / 0.25)",
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
    },
  },
  plugins: [],
}
