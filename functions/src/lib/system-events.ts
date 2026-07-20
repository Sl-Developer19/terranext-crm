import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Dead-letter visibility for scheduled/trigger failures (Doc 19 §5, RR-16):
 * "a silent trigger failure is the worst failure mode this design has."
 * Admin SDK writes bypass Firestore rules — `systemEvents` needs no client
 * rule (it is never client-read or client-written).
 */
export interface SystemEventInput {
  source: string;
  message: string;
  detail?: Record<string, string | number | boolean>;
}

export async function writeSystemEvent(input: SystemEventInput): Promise<void> {
  await getFirestore()
    .collection('systemEvents')
    .add({
      at: FieldValue.serverTimestamp(),
      source: input.source,
      message: input.message,
      detail: input.detail ?? null,
    });
}
