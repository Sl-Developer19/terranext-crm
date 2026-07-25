import 'server-only';

import { headers } from 'next/headers';

/**
 * Request origin for server actions, which — unlike route handlers — have no
 * `NextRequest` to read `nextUrl.origin` from. Used to build absolute links
 * (password-reset emails) without hardcoding a host.
 */
export async function appOrigin(): Promise<string> {
  const store = await headers();
  const host = store.get('x-forwarded-host') ?? store.get('host') ?? 'localhost:3000';
  const proto =
    store.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  return `${proto}://${host}`;
}
