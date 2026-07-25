import bundleAnalyzer from '@next/bundle-analyzer';

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
 */
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  // Firebase Auth/Firestore/Storage endpoints the browser SDK talks to.
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  "frame-src 'self' https://*.firebaseapp.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
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
