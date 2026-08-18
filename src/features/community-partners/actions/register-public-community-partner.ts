import 'server-only';

import { writeAudit } from '@/lib/audit/write';
import { consumeRateLimit, DAY_MS, HOUR_MS } from '@/lib/rate-limit/fixed-window';
import {
  conflictError,
  internalError,
  ok,
  rateLimitedError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { createCommunityPartnerRecord, type CommunityPartnerDuplicateField } from '../repository';
import {
  PARTNER_RATE_LIMITS,
  registerPublicCommunityPartnerSchema,
  type RegisterPublicCommunityPartnerResult,
} from '../public-schema';

const DUPLICATE_MESSAGES: Record<CommunityPartnerDuplicateField, string> = {
  email: 'A Community Partner with this email is already registered.',
  phone: 'A Community Partner with this phone number is already registered.',
  orgName: 'A Community Partner with this business name is already registered.',
};

/**
 * Website → CRM Community Partner Registration form intake (TCGN), mirrors
 * `growth-partners/actions/register-public-growth-partner.ts`.
 *
 * Unauthenticated, matching `createPublicLead`/`registerPublicGrowthPartner`
 * — the marketing site has no session to offer. The record lands as
 * `status: pending_approval` with no `authUid`; a login is only ever minted
 * later, at staff approval, so this does not open a self-signup path.
 */
export async function registerPublicCommunityPartner(
  rawInput: unknown,
  context: { ip: string; userAgent: string },
): Promise<Result<RegisterPublicCommunityPartnerResult>> {
  const parsed = registerPublicCommunityPartnerSchema.safeParse(rawInput);
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
    scope: 'registerCommunityPartner_ip',
    identifier: context.ip,
    limit: PARTNER_RATE_LIMITS.perIpPerHour,
    windowMs: HOUR_MS,
  });
  if (!ipVerdict.allowed) {
    return rateLimitedError('Too many submissions from this network. Please try again later.');
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  const emailVerdict = await consumeRateLimit({
    scope: 'registerCommunityPartner_email',
    identifier: normalizedEmail,
    limit: PARTNER_RATE_LIMITS.perEmailPerDay,
    windowMs: DAY_MS,
  });
  if (!emailVerdict.allowed) {
    return rateLimitedError('This email has already submitted several applications today.');
  }

  try {
    const { id, duplicate } = await createCommunityPartnerRecord(
      {
        orgName: input.orgName,
        businessCategory: input.businessCategory,
        contactName: input.contactName,
        email: normalizedEmail,
        phone: input.phone,
        applicationNotes: input.applicationNotes || null,
      },
      'system',
    );
    if (duplicate) return conflictError(DUPLICATE_MESSAGES[duplicate]);

    await writeAudit({
      actorUid: 'system',
      actorRole: 'system',
      action: 'create',
      entityType: 'community_partner',
      entityId: id,
      entityPath: `communityPartners/${id}`,
      context: { feature: 'community-partners', reason: 'website:registration' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not submit the application. Please try again.');
  }
}
