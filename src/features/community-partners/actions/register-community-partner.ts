'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { createCommunityPartnerRecord, type CommunityPartnerDuplicateField } from '../repository';
import { registerCommunityPartnerSchema, type RegisterCommunityPartnerInput } from '../schema';

const DUPLICATE_MESSAGES: Record<CommunityPartnerDuplicateField, string> = {
  email: 'A Community Partner with this email is already registered.',
  phone: 'A Community Partner with this phone number is already registered.',
  orgName: 'A Community Partner with this business name is already registered.',
};

/**
 * Registers a Community Partner candidate (TCGN), staff entry path — mirrors
 * `growth-partners/actions/register-growth-partner.ts`. No Firebase Auth user
 * or login exists yet — that is minted at approval time
 * (`decideCommunityPartner`), matching "no self-signup path exists anywhere
 * in the app" (`lib/auth/session.ts`).
 */
export async function registerCommunityPartner(
  input: RegisterCommunityPartnerInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  // Reuses the existing `growthPartners:create` permission — no new RBAC
  // module for Community Partners (approved architecture: shared oversight
  // permissions across every partner programme).
  if (!can(session.role, 'growthPartners:create')) return permissionError();

  const parsed = registerCommunityPartnerSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const { orgName, businessCategory, contactName, email, phone } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { id, duplicate } = await createCommunityPartnerRecord(
      {
        orgName,
        businessCategory,
        contactName,
        email: normalizedEmail,
        phone,
        applicationNotes: null,
      },
      session.uid,
    );
    if (duplicate) return conflictError(DUPLICATE_MESSAGES[duplicate]);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'community_partner',
      entityId: id,
      entityPath: `communityPartners/${id}`,
      context: { feature: 'community-partners' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not register the Community Partner. Please try again.');
  }
}
