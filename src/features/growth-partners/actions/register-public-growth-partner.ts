import 'server-only';

import { findDefaultLeadershipLevelSlug } from '@/features/leadership-levels';
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
  // Settings-driven default (Settings §3) — the active level with the
  // lowest display order, not a hardcoded "bronze" literal. Null is a valid
  // outcome (no levels defined yet); the partner simply starts unresolved.
  const defaultLevelSlug = await findDefaultLeadershipLevelSlug();

  try {
    // Transactional check-then-write: two concurrent submissions for the
    // same email must not both pass the duplicate check and land as two
    // `growthPartners` docs (mirrors `community-partners/repository.ts`'s
    // `createCommunityPartnerRecord`, which closes this exact race).
    const ref = db.collection('growthPartners').doc();
    const now = new Date();
    const duplicate = await db.runTransaction(async (tx) => {
      const existing = await tx.get(
        db
          .collection('growthPartners')
          .where('email', '==', normalizedEmail)
          .where('deletedAt', '==', null)
          .limit(1),
      );
      if (!existing.empty) return true;

      tx.set(ref, {
        schemaVersion: 1,
        humanPartnerId: null,
        displayName: input.displayName,
        email: normalizedEmail,
        phone: input.phone,
        organizationName: input.organizationName || null,
        applicationNotes: input.applicationNotes || null,
        status: 'pending_approval',
        leadershipLevel: defaultLevelSlug,
        scanCount: 0,
        referralCount: 0,
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
      return false;
    });
    if (duplicate) {
      return conflictError('A Growth Partner with this email is already registered.');
    }

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
