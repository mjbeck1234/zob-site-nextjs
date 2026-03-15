import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      container: {
        center: true,
        padding: '1rem',
        screens: {
          '2xl': '1200px',
        },
      },
      colors: {
        // Brand palette (from new Cleveland ARTCC logo)
        brand: {
          gold: "#fdc518",
          slate: "#424e51",
          light: "#cccccc",
          dark: "#0b0f10",
        },

        // App tokens (used throughout the UI)
        background: "#0b0f10",
        foreground: "rgba(255,255,255,0.92)",
        card: "rgba(255,255,255,0.035)",
        popover: "rgba(255,255,255,0.04)",
        secondary: "rgba(255,255,255,0.05)",
        muted: "rgba(255,255,255,0.06)",
        accent: "rgba(253,197,24,0.16)",
        border: "rgba(255,255,255,0.12)",
        ring: "rgba(253,197,24,0.55)",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.6rem",
        sm: "0.45rem",
      },

    },
  },
  plugins: [],
} satisfies Config;
