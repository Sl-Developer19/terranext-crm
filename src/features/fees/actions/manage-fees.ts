'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { notifyPartner } from '@/lib/notifications/partner-notifications';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { findProgrammeById } from '@/features/catalogue/repository';
import { findEnrolments } from '@/features/participants/repository';

import { formatPaise } from '@/features/catalogue/logic';
import { isDiscountValid } from '../logic';
import {
  applyDiscountRecord,
  createFeeAccountRecord,
  findFeeAccountById,
  recordPaymentRecord,
  reversePaymentRecord,
} from '../repository';
import {
  applyDiscountSchema,
  createFeeAccountSchema,
  recordPaymentSchema,
  reversePaymentSchema,
  type ApplyDiscountInput,
  type CreateFeeAccountInput,
  type RecordPaymentInput,
  type ReversePaymentInput,
} from '../schema';

/** Fee accounts, payments, and discounts (Doc 19 §2, ADR-012). */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    fields[issue.path.join('.') || 'form'] ??= issue.message;
  }
  return fields;
}

/**
 * Opens the fee account for an enrolment from the programme's default plan.
 * Lands here rather than automatically at enrolment because the catalogue
 * plan may not exist yet for historic records; `convertLead` (M3) will call
 * the same repository function inside its own transaction.
 */
export async function createFeeAccount(
  input: CreateFeeAccountInput,
): Promise<Result<{ created: boolean }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'fees:create')) return permissionError();

  const parsed = createFeeAccountSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { participantId, enrolmentId } = parsed.data;

  try {
    const enrolments = await findEnrolments(participantId);
    const enrolment = enrolments.find((e) => e.id === enrolmentId);
    if (!enrolment) return notFoundError('Enrolment not found.');

    const programme = await findProgrammeById(enrolment.programmeId);
    if (!programme) {
      return validationError({ enrolmentId: 'This enrolment references a missing programme.' });
    }

    const created = await createFeeAccountRecord({
      participantId,
      enrolmentId,
      programmeId: enrolment.programmeId,
      enrolledAt: enrolment.enrolledAt ? new Date(enrolment.enrolledAt) : new Date(),
      totalPaise: programme.feePlanDefault.totalPaise,
      planInstallments: programme.feePlanDefault.installments,
      actorUid: session.uid,
      branchId: session.branchId,
    });

    if (created) {
      await writeAudit({
        actorUid: session.uid,
        actorRole: session.role,
        action: 'create',
        entityType: 'fee_account',
        entityId: enrolmentId,
        entityPath: `feeAccounts/${enrolmentId}`,
        context: { feature: 'fees' },
      });
    }

    return ok({ created });
  } catch {
    return internalError('Could not open the fee account. Please try again.');
  }
}

/** Records a payment and mints its receipt number (gapless per FY). */
export async function recordPayment(
  input: RecordPaymentInput,
): Promise<Result<{ receiptNo: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'fees:create')) return permissionError();

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { feeAccountId, amountPaise, method, receivedAt, note } = parsed.data;

  try {
    const outcome = await recordPaymentRecord(
      feeAccountId,
      { amountPaise, method, receivedAt: new Date(receivedAt), note: note || null },
      session.uid,
    );

    if (outcome.kind === 'account_missing') return notFoundError('Fee account not found.');
    if (outcome.kind === 'exceeds_balance') {
      return validationError({
        amountPaise: `That exceeds the outstanding balance of ${formatPaise(outcome.balancePaise)}.`,
      });
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'payment',
      entityId: outcome.paymentId,
      entityPath: `feeAccounts/${feeAccountId}/payments/${outcome.paymentId}`,
      changes: { amountPaise: { before: null, after: amountPaise } },
      context: { feature: 'fees', reason: `receipt:${outcome.receiptNo}` },
    });

    // Doc 25 §10 — the reward already committed atomically with the payment
    // inside recordPaymentRecord's own transaction; this is the audit trail
    // and the partner-facing notification, deliberately outside it (a
    // transaction callback can be retried, so side effects like these must
    // never live inside one).
    if (outcome.reward) {
      await writeAudit({
        actorUid: session.uid,
        actorRole: session.role,
        action: 'create',
        entityType: 'reward_ledger_entry',
        entityId: outcome.reward.ledgerId,
        entityPath: `rewardLedger/${outcome.reward.ledgerId}`,
        changes: { amountPaise: { before: null, after: outcome.reward.amountPaise } },
        context: { feature: 'rewards', reason: `payment:${outcome.paymentId}` },
      });

      await notifyPartner(outcome.reward.partnerId, {
        type: 'reward_generated',
        message: `You earned ${formatPaise(outcome.reward.amountPaise)} for a successful admission payment.`,
      }).catch(() => undefined);
    }

    return ok({ receiptNo: outcome.receiptNo });
  } catch {
    return internalError('Could not record the payment. Please try again.');
  }
}

/** Reverses a payment with a compensating entry — never an edit or delete. */
export async function reversePayment(input: ReversePaymentInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'fees:update')) return permissionError();

  const parsed = reversePaymentSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { feeAccountId, paymentId, reason } = parsed.data;

  try {
    const outcome = await reversePaymentRecord(feeAccountId, paymentId, reason, session.uid);
    if (outcome === 'not_found') return notFoundError('Payment not found.');
    if (outcome === 'already_reversed') {
      return conflictError('This payment has already been reversed.');
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'override',
      entityType: 'payment',
      entityId: paymentId,
      entityPath: `feeAccounts/${feeAccountId}/payments/${paymentId}`,
      context: { feature: 'fees', reason },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not reverse the payment. Please try again.');
  }
}

/**
 * Applies a discount. Requires `fees:approve` — a rank the Finance Officer
 * deliberately does not hold (Doc 04 §3), so the person who collects money
 * cannot also unilaterally reduce what is owed.
 */
export async function applyDiscount(input: ApplyDiscountInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'fees:approve')) {
    return permissionError('A discount requires approval from an Operations Manager or Founder.');
  }

  const parsed = applyDiscountSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { feeAccountId, discountPaise, reason } = parsed.data;

  try {
    const account = await findFeeAccountById(feeAccountId);
    if (!account) return notFoundError('Fee account not found.');

    if (!isDiscountValid(account.totalPaise, discountPaise)) {
      return validationError({
        discountPaise: `A discount cannot exceed the total fee of ${formatPaise(account.totalPaise)}.`,
      });
    }

    await applyDiscountRecord(feeAccountId, discountPaise, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'override',
      entityType: 'fee_account',
      entityId: feeAccountId,
      entityPath: `feeAccounts/${feeAccountId}`,
      changes: { discountPaise: { before: account.discountPaise, after: discountPaise } },
      context: { feature: 'fees', reason },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not apply the discount. Please try again.');
  }
}
