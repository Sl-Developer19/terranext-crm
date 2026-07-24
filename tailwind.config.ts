import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Design tokens per Doc 07 (Design System Blueprint).
 * All colors are CSS variables defined in src/app/globals.css — the pending
 * brand-guidelines swap (BRD §27 dependency) is a globals.css change only.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          secondary: 'hsl(var(--foreground-secondary))',
        },
        surface: 'hsl(var(--surface))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Brand accents (Doc 07 §1 brand swap) — gold primary, emerald secondary
        gold: {
          DEFAULT: 'hsl(var(--gold))',
          hover: 'hsl(var(--gold-hover))',
        },
        emerald: {
          DEFAULT: 'hsl(var(--emerald))',
          hover: 'hsl(var(--emerald-hover))',
        },
        // Status palette (Doc 07 §1) — fixed semantics, brand-independent
        status: {
          info: 'hsl(var(--status-info))',
          progress: 'hsl(var(--status-progress))',
          success: 'hsl(var(--status-success))',
          danger: 'hsl(var(--status-danger))',
          neutral: 'hsl(var(--status-neutral))',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        heading: ['var(--font-heading)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        premium: '0 1px 2px hsl(0 0% 0% / 0.4), 0 12px 32px -12px hsl(0 0% 0% / 0.5)',
        'premium-lg': '0 4px 12px hsl(0 0% 0% / 0.45), 0 24px 48px -16px hsl(0 0% 0% / 0.6)',
        'glow-gold': '0 0 0 1px hsl(var(--gold) / 0.4), 0 8px 24px -8px hsl(var(--gold) / 0.35)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.8s infinite',
        'fade-up': 'fade-up 0.25s ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
