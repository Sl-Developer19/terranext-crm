import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

/**
 * Growth Partner notifications (Doc 25 §14) — `partnerNotifications/{partnerId}/items/{id}`.
 * Written after the triggering write has already committed (never inside
 * another operation's Firestore transaction — a transaction callback can be
 * retried by the SDK, and a plain `.add()` inside one is not safe to repeat).
 */
export const PARTNER_NOTIFICATION_TYPES = [
  'partner_approved',
  'lead_submitted',
  'admission_approved',
  'payment_successful',
  'reward_generated',
  'reward_paid',
] as const;
export type PartnerNotificationType = (typeof PARTNER_NOTIFICATION_TYPES)[number];

export interface PartnerNotification {
  id: string;
  type: PartnerNotificationType;
  message: string;
  read: boolean;
  createdAt: string;
}

export async function notifyPartner(
  partnerId: string,
  input: { type: PartnerNotificationType; message: string },
): Promise<void> {
  await adminDb().collection('partnerNotifications').doc(partnerId).collection('items').add({
    type: input.type,
    message: input.message,
    read: false,
    createdAt: new Date(),
  });
}

export async function listPartnerNotifications(partnerId: string): Promise<PartnerNotification[]> {
  const snap = await adminDb()
    .collection('partnerNotifications')
    .doc(partnerId)
    .collection('items')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    const createdAt =
      data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : '';
    return {
      id: doc.id,
      type: data.type,
      message: typeof data.message === 'string' ? data.message : '',
      read: data.read === true,
      createdAt,
    };
  });
}
