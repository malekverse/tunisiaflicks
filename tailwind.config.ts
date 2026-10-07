import type { Config } from "tailwindcss"

// Design tokens for the "dark room" look: a black page lit by the content, with the logo's red as
// the only signal colour. The shadcn colour names (background, primary...) map onto the same
// palette so the Radix-based primitives in components/ui follow it.
const config = {
  darkMode: ["class"],
  // `hover:` only applies on devices that really hover: no sticky hover states after a tap.
  future: { hoverOnlyWhenSupported: true },
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // The logo red (#FF1000 family). Every `red-*` in the codebase uses this scale.
        red: {
          50: '#FFF1F0',
          100: '#FFE0DD',
          200: '#FFC4BF',
          300: '#FF9A91',
          400: '#FF5E52',
          500: '#FF2414',
          600: '#E50F05',
          700: '#BD0C04',
          800: '#9A0E08',
          900: '#7F120E',
          950: '#460502',
        },
        star: '#FFC53D',
        border: "rgb(255 255 255 / 0.09)",
        input: "rgb(255 255 255 / 0.12)",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        // Readex Pro covers Latin and Arabic, so the UI reads the same in every language.
        sans: ['var(--font-text)', 'system-ui', 'sans-serif'],
        // Titles: condensed Bricolage Grotesque for Latin, Alexandria for Arabic (per glyph).
        display: ['var(--font-display)', 'var(--font-display-ar)', 'var(--font-text)', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        poster: '10px',
        tile: '14px',
        panel: '22px',
        stage: '28px',
      },
      spacing: {
        rail: 'var(--rail)',
        gutter: 'var(--gutter)',
        topbar: 'var(--topbar)',
      },
      transitionTimingFunction: {
        // Strong ease-out: quick to react, soft to land. Never ease-in for things appearing.
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // "Coming into focus": the projector's way of showing something new.
        "focus-in": {
          from: { opacity: "0", filter: "blur(8px)", transform: "scale(1.015)" },
          to: { opacity: "1", filter: "blur(0)", transform: "scale(1)" },
        },
        // Ends on `none` and only fills backwards: once done, the page keeps no transform (a
        // leftover transform would trap position:fixed overlays inside it).
        "page-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        "ken-burns": {
          from: { transform: "scale(1.02)" },
          to: { transform: "scale(1.12) translate3d(-1.2%, -0.8%, 0)" },
        },
        "segment-fill": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        "poster-wall": {
          from: { transform: "translate3d(0, 0, 0)" },
          to: { transform: "translate3d(0, -50%, 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "focus-in": "focus-in 0.7s cubic-bezier(0.23, 1, 0.32, 1) both",
        "page-in": "page-in 0.36s cubic-bezier(0.23, 1, 0.32, 1) backwards",
        "ken-burns": "ken-burns 20s cubic-bezier(0.23, 1, 0.32, 1) both",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.23, 1, 0.32, 1) infinite",
        "poster-wall": "poster-wall 90s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
