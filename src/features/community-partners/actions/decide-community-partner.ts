'use server';

import { writeAudit } from '@/lib/audit/write';
import { generateBrandedResetLink } from '@/lib/auth/reset-link';
import { getSession } from '@/lib/auth/session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { appOrigin } from '@/lib/http/app-origin';
import { notifyPartner } from '@/lib/notifications/partner-notifications';
import { renderBrandedEmailHtml } from '@/lib/messaging/email-template';
import { getEmailProvider } from '@/lib/messaging/providers';
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

import { getBrandingSettings, getIdFormats } from '@/features/settings';

import { canDecide } from '../logic';
import { reserveCommunityPartnerId } from '../repository';
import { decideCommunityPartnerSchema, type DecideCommunityPartnerInput } from '../schema';

/**
 * Approves or rejects a pending Community Partner (TCGN) — mirrors
 * `growth-partners/actions/decide-growth-partner.ts` (same permission, same
 * Firebase Auth account + custom claim minting, same branded-reset-link
 * onboarding email), with one deliberate hardening beyond that precedent:
 * the final status transition is a Firestore transaction that re-checks
 * `pending_approval` immediately before writing, closing the race between
 * two admins deciding the same partner concurrently. If that transaction
 * loses the race after a *new* Auth account was created in this call, the
 * account is deleted rather than left orphaned with live claims pointing at
 * a partner record that never actually transitioned.
 */
export async function decideCommunityPartner(
  input: DecideCommunityPartnerInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  // Reuses the existing `growthPartners:approve` permission — no new RBAC
  // module for Community Partners (approved architecture).
  if (!can(session.role, 'growthPartners:approve')) return permissionError();

  const parsed = decideCommunityPartnerSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const { partnerId, decision, reason } = parsed.data;

  const db = adminDb();
  const ref = db.collection('communityPartners').doc(partnerId);
  const snap = await ref.get();
  if (!snap.exists || snap.get('deletedAt') !== null) {
    return notFoundError('Community Partner not found.');
  }
  const status = snap.get('status');
  if (!canDecide(status)) {
    return conflictError('This Community Partner has already been decided.');
  }

  const now = new Date();
  const orgName = snap.get('orgName') as string;
  const contactName = snap.get('contactName') as string;
  const email = snap.get('email') as string;

  if (decision === 'reject') {
    let outcome: 'not_found' | 'conflict' | 'ok';
    try {
      outcome = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists || fresh.get('deletedAt') !== null) return 'not_found' as const;
        if (!canDecide(fresh.get('status'))) return 'conflict' as const;
        // Reject never mints a Human Partner ID — no `reserveCommunityPartnerId`
        // call on this branch, by design (business rule: a rejected
        // application must never consume a sequence number).
        tx.update(ref, { status: 'rejected', updatedAt: now, updatedBy: session.uid });
        return 'ok' as const;
      });
    } catch {
      return internalError('Could not reject the Community Partner. Please try again.');
    }

    if (outcome === 'not_found') return notFoundError('Community Partner not found.');
    if (outcome === 'conflict')
      return conflictError('This Community Partner has already been decided.');

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'community_partner',
      entityId: partnerId,
      entityPath: `communityPartners/${partnerId}`,
      changes: { status: { before: status, after: 'rejected' } },
      context: reason
        ? { feature: 'community-partners', reason }
        : { feature: 'community-partners' },
    });
    return ok({ ok: true });
  }

  // decision === 'approve'
  const auth = adminAuth();
  let authUid: string;
  let createdFreshAuthUser = false;
  try {
    try {
      const existingUser = await auth.getUserByEmail(email);
      authUid = existingUser.uid;
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
      const created = await auth.createUser({ email, displayName: orgName, emailVerified: false });
      authUid = created.uid;
      createdFreshAuthUser = true;
    }
    // No `role` claim (ADR-014): a Community Partner must never satisfy
    // `toStaffRole()`/`isStaff()` — same parallel actor namespace as
    // individual Growth Partners, distinguished only by `partnerType`.
    await auth.setCustomUserClaims(authUid, {
      actorType: 'growth_partner',
      partnerId,
      partnerType: 'community_business',
      partnerStatus: 'active',
    });
  } catch {
    return internalError('Could not create the partner account. Please try again.');
  }

  type DecisionOutcome =
    { kind: 'not_found' } | { kind: 'conflict' } | { kind: 'ok'; humanPartnerId: string };

  // Settings is slow-changing config, not part of the transaction's
  // consistency requirements — read once, outside the transaction, same as
  // any other config lookup would be.
  const idFormats = await getIdFormats();

  let outcome: DecisionOutcome;
  try {
    outcome = await db.runTransaction<DecisionOutcome>(async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists || fresh.get('deletedAt') !== null) return { kind: 'not_found' };
      if (!canDecide(fresh.get('status'))) return { kind: 'conflict' };

      // Human Partner ID is minted HERE — inside the same transaction as the
      // status transition, after the pending-approval re-check and before any
      // write — so a lost race or a not-found record never consumes a
      // sequence number (business rule: IDs are permanent and never skipped
      // by a decision that didn't actually happen). See
      // `repository.ts#reserveCommunityPartnerId` for the counter mechanics.
      const humanPartnerId = await reserveCommunityPartnerId(tx, idFormats.communityPartnerPrefix);

      tx.update(ref, {
        status: 'active',
        authUid,
        humanPartnerId,
        approvedAt: now,
        approvedBy: session.uid,
        updatedAt: now,
        updatedBy: session.uid,
      });
      return { kind: 'ok', humanPartnerId };
    });
  } catch {
    // The transaction itself failed (e.g. retries exhausted under heavy
    // contention, or a genuine Firestore error) — roll back a freshly-created
    // Auth account rather than leave it orphaned, and report a clean error
    // instead of letting the exception escape the action.
    if (createdFreshAuthUser) {
      await adminAuth()
        .deleteUser(authUid)
        .catch(() => undefined);
    }
    return internalError('Could not approve the Community Partner. Please try again.');
  }

  if (outcome.kind !== 'ok') {
    // Lost the race (or the record vanished) after minting/claiming the Auth
    // account above — roll back a freshly-created one so it's never left
    // orphaned with live partner claims pointing at a record that never
    // actually transitioned. An account we merely *found* (getUserByEmail)
    // is never deleted — it may be in legitimate use elsewhere.
    if (createdFreshAuthUser) {
      await adminAuth()
        .deleteUser(authUid)
        .catch(() => undefined);
    }
    if (outcome.kind === 'not_found') return notFoundError('Community Partner not found.');
    return conflictError('This Community Partner has already been decided.');
  }

  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'status_change',
    entityType: 'community_partner',
    entityId: partnerId,
    entityPath: `communityPartners/${partnerId}`,
    changes: {
      status: { before: status, after: 'active' },
      humanPartnerId: { before: null, after: outcome.humanPartnerId },
    },
    context: { feature: 'community-partners' },
  });

  const origin = await appOrigin();
  const branding = await getBrandingSettings();
  const brandedLink = await generateBrandedResetLink(email, origin);
  // Approval never rolls back on a failed/skipped send (already committed
  // above) — these fields just make the outcome visible afterwards instead
  // of only in server logs.
  if (brandedLink) {
    const bodyText =
      `${contactName}, ${orgName}'s Community Partner account has been approved.\n\n` +
      'Set your password to sign in to the partner portal for the first time.';
    // eslint-disable-next-line no-console
    console.log('[email] sending Community Partner welcome email to recipient:', email);
    const outcome2 = await getEmailProvider().send({
      to: email,
      subject: 'Your Community Partner account is approved',
      body: [
        bodyText,
        '',
        `Set your password: ${brandedLink}`,
        '',
        'This link expires in 1 hour and can only be used once.',
      ].join('\n'),
      html: renderBrandedEmailHtml({
        heading: 'Welcome, Community Partner',
        preheader: 'Your Community Partner account is approved.',
        bodyText,
        cta: { label: 'Set your password', url: brandedLink },
        footerNote: 'This link expires in 1 hour and can only be used once.',
        appOrigin: origin,
        logoUrl: branding.emailLogoUrl || undefined,
      }),
    });
    if (outcome2.status === 'failed') {
      console.error('Community Partner welcome email failed to send:', outcome2.reason);
    }
    await ref
      .update({
        emailSent: outcome2.status === 'sent',
        emailSentAt: new Date(),
        emailStatus: outcome2.status === 'sent' ? 'sent' : 'failed',
        emailError: outcome2.status === 'sent' ? null : outcome2.reason,
      })
      .catch(() => undefined);
  } else {
    await ref
      .update({
        emailSent: false,
        emailSentAt: new Date(),
        emailStatus: 'skipped',
        emailError: null,
      })
      .catch(() => undefined);
  }

  await notifyPartner(partnerId, {
    type: 'partner_approved',
    message: 'Your Community Partner account has been approved.',
  }).catch(() => undefined);

  return ok({ ok: true });
}
