import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
        display: ["'Space Grotesk'", "sans-serif"],
      },
      colors: {
        bg: {
          DEFAULT: "#0d1117",
          secondary: "#161b22",
          tertiary: "#21262d",
          quaternary: "#30363d",
        },
        border: { DEFAULT: "#30363d", strong: "#484f58" },
        accent: { DEFAULT: "#0ea5e9", light: "#38bdf8", dark: "#0284c7" },
        azure: { DEFAULT: "#0078D4", light: "#50e6ff" },
        success: "#22c55e",
        warn: "#f59e0b",
        danger: "#ef4444",
        muted: "#8b949e",
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
      },
      animation: {
        "fade-up": "fadeUp 0.2s ease forwards",
        "slide-in": "slideIn 0.25s ease forwards",
        spin: "spin 0.7s linear infinite",
      },
      keyframes: {
        fadeUp: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        slideIn: { from: { opacity: "0", transform: "translateX(-8px)" }, to: { opacity: "1", transform: "none" } },
      },
    },
  },
  plugins: [],
};

export default config;
