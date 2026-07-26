import 'server-only';

import { writeAudit } from '@/lib/audit/write';
import { adminDb } from '@/lib/firebase/admin';
import { consumeRateLimit, DAY_MS, HOUR_MS } from '@/lib/rate-limit/fixed-window';
import {
  conflictError,
  internalError,
  ok,
  rateLimitedError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import {
  PARTNER_RATE_LIMITS,
  registerPublicGrowthPartnerSchema,
  type RegisterPublicGrowthPartnerResult,
} from '../public-schema';

/**
 * Website → CRM Growth Partner Registration form intake (Doc 25 §4 step 1).
 *
 * Unauthenticated, matching `createPublicLead` — the marketing site has no
 * session to offer. The record lands as `status: pending_approval` with no
 * `authUid`; a login is only ever minted later, at staff approval
 * (`decideGrowthPartner`), so this does not open a self-signup path.
 */
export async function registerPublicGrowthPartner(
  rawInput: unknown,
  context: { ip: string; userAgent: string },
): Promise<Result<RegisterPublicGrowthPartnerResult>> {
  const parsed = registerPublicGrowthPartnerSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const input = parsed.data;

  // Honeypot: answer exactly as a success would, but write nothing.
  if (input.hp_field) {
    return ok({ id: 'accepted' });
  }

  const ipVerdict = await consumeRateLimit({
    scope: 'registerPartner_ip',
    identifier: context.ip,
    limit: PARTNER_RATE_LIMITS.perIpPerHour,
    windowMs: HOUR_MS,
  });
  if (!ipVerdict.allowed) {
    return rateLimitedError('Too many submissions from this network. Please try again later.');
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  const emailVerdict = await consumeRateLimit({
    scope: 'registerPartner_email',
    identifier: normalizedEmail,
    limit: PARTNER_RATE_LIMITS.perEmailPerDay,
    windowMs: DAY_MS,
  });
  if (!emailVerdict.allowed) {
    return rateLimitedError('This email has already submitted several applications today.');
  }

  const db = adminDb();

  try {
    const existing = await db
      .collection('growthPartners')
      .where('email', '==', normalizedEmail)
      .where('deletedAt', '==', null)
      .limit(1)
      .get();
    if (!existing.empty) {
      return conflictError('A Growth Partner with this email is already registered.');
    }

    const ref = db.collection('growthPartners').doc();
    const now = new Date();
    await ref.set({
      schemaVersion: 1,
      displayName: input.displayName,
      email: normalizedEmail,
      phone: input.phone,
      organizationName: input.organizationName || null,
      status: 'pending_approval',
      leadershipLevel: 'bronze',
      authUid: null,
      approvedAt: null,
      approvedBy: null,
      lastLoginAt: null,
      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system',
      deletedAt: null,
      deletedBy: null,
    });

    await writeAudit({
      actorUid: 'system',
      actorRole: 'system',
      action: 'create',
      entityType: 'growth_partner',
      entityId: ref.id,
      entityPath: `growthPartners/${ref.id}`,
      context: { feature: 'growth-partners', reason: 'website:registration' },
    });

    return ok({ id: ref.id });
  } catch {
    return internalError('Could not submit the application. Please try again.');
  }
}
