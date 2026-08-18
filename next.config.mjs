import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bundleAnalyzer from '@next/bundle-analyzer';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/**
 * Security response headers (Doc 10 §5).
 *
 * These are defence-in-depth for a CRM holding participant PII. Notes on the
 * two that carry real trade-offs:
 *
 * - **CSP** allows `'unsafe-inline'` for styles because Tailwind's runtime and
 *   Next's style injection both emit inline styles; script-src does not, so
 *   the XSS-execution path stays closed. `'unsafe-eval'` is dev-only (React
 *   Refresh needs it) and is absent from production.
 * - **HSTS** is set with a two-year max-age and `preload`. That is effectively
 *   irreversible for the domain, which is correct for an authenticated app
 *   that should never be reachable over plaintext HTTP.
 * - **`upgrade-insecure-requests`** rewrites every sub-resource request
 *   (same-origin included) from `http:` to `https:` before it's sent. Fine
 *   in production, where the app is only ever served over HTTPS — actively
 *   breaks dev/LAN access over plain HTTP (e.g. `http://192.168.x.x:3000`),
 *   where the browser dutifully upgrades `/_next/static/...`, `/favicon.ico`,
 *   etc. to `https://` and gets `ERR_SSL_PROTOCOL_ERROR` since nothing is
 *   listening there. `localhost` is exempt (browsers treat it as a secure
 *   context), which is why this only surfaces when reached by IP. Gated the
 *   same way HSTS already is, for the same reason.
 */
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com${isDev ? ' http://127.0.0.1:9199' : ''}`,
  "font-src 'self' data:",
  // Firebase Auth/Firestore/Storage endpoints the browser SDK talks to.
  // Dev-only: the emulator ports (Auth 9099, Firestore 8080, Storage 9199)
  // so client-side Firebase SDK calls (e.g. the certificate artwork's
  // direct-to-Storage upload) aren't silently CSP-blocked when running
  // against `NEXT_PUBLIC_USE_EMULATORS=true` — production only ever talks
  // to the real *.googleapis.com hosts already listed below.
  `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com${isDev ? ' http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:9199' : ''}`,
  "frame-src 'self' https://*.firebaseapp.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // microphone=(self): the AI Intelligence Platform's session recorder
    // calls getUserMedia({ audio: true }) from this origin's own top-level
    // document (never embedded/cross-origin) — an empty allowlist blocks
    // that same-origin call too, not just third-party embeds. Every other
    // feature here is unused by the app, so stays fully disallowed.
    value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ...(isDev
    ? []
    : [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // A stray lockfile one level up (`D:\terranext_website\package-lock.json`,
  // outside this app — the monorepo-looking parent also holds sibling
  // `terranext`/`portfolio` projects) makes Next.js misinfer the workspace
  // root as that parent, widening the dev file-tracing/watch scope to
  // everything under it. Pinning explicitly avoids depending on those
  // unrelated sibling directories' state.
  outputFileTracingRoot: projectRoot,
  eslint: {
    dirs: ['src'],
  },
  images: {
    // Participant/employer document previews would render via the Storage
    // signed-URL flow (src/features/participants/actions/manage-documents.ts);
    // the CSP img-src above already allowlists this host for plain <img>, so
    // next/image needs the matching remotePattern to serve the same URLs.
    remotePatterns: [{ protocol: 'https', hostname: 'firebasestorage.googleapis.com' }],
  },
  experimental: {
    // lucide-react is imported piecemeal across nearly every table/component;
    // this lets Next tree-shake it per-icon instead of pulling the barrel.
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // The Firebase Local Emulator Suite (run from this same directory for
      // `crm-dev-emulator`) writes *-debug.log continuously to the project
      // root. Webpack's dev watcher isn't scoped by .gitignore, so without
      // this it treats every emulator log write as a source change and
      // fires an unnecessary Fast Refresh rebuild on nearly every
      // Firestore/Auth/Storage call — i.e. on every form submission.
      const ignored = Array.isArray(config.watchOptions?.ignored)
        ? config.watchOptions.ignored
        : [];
      config.watchOptions = { ...config.watchOptions, ignored: [...ignored, '**/*-debug.log'] };
    }
    return config;
  },
  async headers() {
    return [
      {
        // Applies everywhere. The public intake route sets its own
        // Access-Control-* headers, which are disjoint from this set, so the
        // two merge without conflict and the endpoint stays cross-origin
        // callable by the website.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
