import type { Config } from "tailwindcss";

/**
 * Identité SOS Maison : bleu nuit pour le texte, mandarine pour l'action,
 * soleil pour la réussite, menthe pour « résolu », ciel et lilas pour les médias.
 * Les alias brand / warm / danger gardent compatibles les anciennes classes.
 */
const palette = {
  ink: "#1b1f3b",
  tangerine: { DEFAULT: "#ff6b2c", dark: "#e9531a", 50: "#ffe9df" },
  sun: { DEFAULT: "#ffc83d", 50: "#fff6d9", 700: "#8a5a00" },
  mint: { DEFAULT: "#22b8a0", 50: "#ddf6f1", 700: "#0e7d6c" },
  sky: { DEFAULT: "#3d7bff", 50: "#e4edff", 700: "#2350c7" },
  lilac: { DEFAULT: "#8b6cff", 50: "#eee9ff" },
  paper: "#f4f6fb",
  line: "#e3e7f1",
  muted: "#5d6480",
};

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ...palette,
        brand: { 50: "#e4edff", 100: "#d4e2ff", 500: "#ff6b2c", 600: "#e9531a", 700: "#c9450f", 900: "#1b1f3b" },
        warm: { 50: "#fff6d9", 100: "#ffe7a3", 500: "#ffc83d" },
        danger: { 50: "#fdecee", 600: "#d62839", 700: "#b01e2e" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Avenir Next", "Trebuchet MS", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "Segoe UI", "Roboto", "system-ui", "sans-serif"],
      },
      fontSize: { base: ["1.0625rem", "1.55"] },
      borderRadius: { "4xl": "1.75rem" },
      boxShadow: {
        chunky: "0 5px 0 #1b1f3b",
        soft: "0 2px 0 rgba(27,31,59,.06)",
        lift: "0 6px 0 rgba(27,31,59,.18)",
      },
      keyframes: {
        blink: { "0%,92%,100%": { transform: "scaleY(1)" }, "95%": { transform: "scaleY(.1)" } },
        wave: { "0%,60%,100%": { transform: "rotate(0)" }, "70%": { transform: "rotate(-14deg)" }, "80%": { transform: "rotate(8deg)" } },
        hop: { "0%,60%,100%": { transform: "translateY(0)" }, "30%": { transform: "translateY(-6px)" } },
        ring: { from: { transform: "scale(.9)", opacity: "1" }, to: { transform: "scale(1.25)", opacity: "0" } },
        pop: { "0%": { transform: "scale(.6)", opacity: "0" }, "70%": { transform: "scale(1.06)" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: {
        blink: "blink 4.5s infinite",
        wave: "wave 2.6s ease-in-out infinite",
        hop: "hop 1s infinite",
        ring: "ring 1.6s infinite",
        pop: "pop .35s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
