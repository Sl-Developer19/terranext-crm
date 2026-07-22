import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

/**
 * `markOverdueInstallments` (Doc 19 §4, daily 01:00 IST).
 *
 * Flips `pending` installments whose due date has passed to `overdue` and
 * refreshes the denormalised `nextDueDate` the pending-fee report reads.
 *
 * Only ever touches `pending` rows: a `paid` installment is settled history,
 * and re-deriving it from dates would let a clock skew unpay someone.
 */

export interface OverdueSummary {
  accountsExamined: number;
  accountsUpdated: number;
  installmentsMarkedOverdue: number;
}

interface Installment {
  label: string;
  amountPaise: number;
  dueDate: Timestamp | null;
  status: 'pending' | 'paid' | 'overdue';
}

export async function markOverdueInstallments(now: Date = new Date()): Promise<OverdueSummary> {
  const db = adminDb();
  const summary: OverdueSummary = {
    accountsExamined: 0,
    accountsUpdated: 0,
    installmentsMarkedOverdue: 0,
  };

  const snap = await db.collection('feeAccounts').limit(1000).get();

  for (const doc of snap.docs) {
    summary.accountsExamined += 1;

    const plan = (doc.get('plan') ?? {}) as { installments?: Installment[] };
    const installments = plan.installments ?? [];
    if (installments.length === 0) continue;

    let changed = false;
    const updated = installments.map((installment) => {
      const due = installment.dueDate instanceof Timestamp ? installment.dueDate.toDate() : null;
      if (installment.status === 'pending' && due && due < now) {
        changed = true;
        summary.installmentsMarkedOverdue += 1;
        return { ...installment, status: 'overdue' as const };
      }
      return installment;
    });

    // The next thing actually owed — earliest unsettled due date, overdue
    // included, since an overdue instalment is still what the desk chases.
    const nextDue = updated
      .filter((i) => i.status !== 'paid' && i.dueDate instanceof Timestamp)
      .map((i) => (i.dueDate as Timestamp).toMillis())
      .sort((a, b) => a - b)[0];

    const currentNextDue = doc.get('nextDueDate');
    const currentMillis = currentNextDue instanceof Timestamp ? currentNextDue.toMillis() : null;
    const nextDueChanged = (nextDue ?? null) !== currentMillis;

    if (!changed && !nextDueChanged) continue;

    await doc.ref.update({
      'plan.installments': updated,
      nextDueDate: nextDue ? Timestamp.fromMillis(nextDue) : null,
      updatedAt: now,
      updatedBy: 'system',
    });
    summary.accountsUpdated += 1;
  }

  return summary;
}
