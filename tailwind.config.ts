import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef6ff", 100: "#d9eaff", 500: "#1f6feb", 600: "#1a5fd0", 700: "#154ea9", 900: "#0b2a5c" },
        warm: { 50: "#fff8ef", 100: "#ffeccf", 500: "#f59e0b" },
        danger: { 50: "#fef2f2", 600: "#dc2626", 700: "#b91c1c" },
      },
      fontSize: { base: ["1.0625rem", "1.6"] },
    },
  },
  plugins: [],
} satisfies Config;
