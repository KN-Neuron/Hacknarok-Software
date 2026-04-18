/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Editorial / refined palette — granat + bursztyn + kreda
        ink: {
          50:  "#f6f5f0",
          100: "#ebe9df",
          200: "#d6d2c2",
          300: "#a8a394",
          400: "#6f6b5f",
          500: "#3d3a32",
          600: "#26241f",
          700: "#1a1814",
          800: "#100f0c",
          900: "#08070605",
          950: "#040403",
        },
        amber: {
          glow: "#f5b04a",
          deep: "#c47e1a",
        },
        verified:    "#7ab87a",
        recovered:   "#d9b04a",
        clash:       "#e25c4a",
        unverified:  "#5a5650",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia"],
        body:    ["var(--font-body)", "ui-sans-serif", "system-ui"],
        mono:    ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
      },
      animation: {
        "fade-in":     "fadeIn 0.4s ease-out",
        "slide-up":    "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft":  "pulseSoft 2.5s ease-in-out infinite",
        "shimmer":     "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn:    { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp:   { from: { opacity: "0", transform: "translateY(8px)" },
                     to:   { opacity: "1", transform: "translateY(0)" } },
        pulseSoft: { "0%, 100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
        shimmer:   { "0%": { backgroundPosition: "-200% 0" },
                     "100%": { backgroundPosition: "200% 0" } },
      },
      backgroundImage: {
        "noise": "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
};
