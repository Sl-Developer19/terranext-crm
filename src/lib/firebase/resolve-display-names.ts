import 'server-only';

import { adminDb } from './admin';

/**
 * Resolves `users/{uid}.displayName` for a set of uids — deduplicated and
 * parallelized, never one query per row. Was reimplemented identically in
 * career, leads, parents, placements, and participants; this is the one copy.
 */
export async function resolveDisplayNames(uids: Iterable<unknown>): Promise<Map<string, string>> {
  const unique = [
    ...new Set([...uids].filter((v): v is string => typeof v === 'string' && v !== '')),
  ];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (uid) => {
      const snap = await adminDb().collection('users').doc(uid).get();
      const name = snap.get('displayName');
      map.set(uid, typeof name === 'string' ? name : 'Unknown');
    }),
  );
  return map;
}
