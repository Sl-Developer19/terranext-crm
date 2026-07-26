import 'server-only';

import { enqueueTemplatedMessage } from '@/features/communications/enqueue';
import { writeAudit } from '@/lib/audit/write';
import { adminDb } from '@/lib/firebase/admin';
import { consumeRateLimit, DAY_MS, HOUR_MS } from '@/lib/rate-limit/fixed-window';
import {
  internalError,
  ok,
  rateLimitedError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { createPublicLeadSchema, RATE_LIMITS, type CreatePublicLeadResult } from '../public-schema';

/**
 * Website → CRM intake (BR-07, Doc 20 §2).
 *
 * BR-07's promise is that no enquiry is ever lost, which shapes two decisions:
 * a repeat phone number updates the existing lead rather than being rejected,
 * and the rate limiter fails open rather than closed.
 */
export async function createPublicLead(
  rawInput: unknown,
  context: { ip: string; userAgent: string },
): Promise<Result<CreatePublicLeadResult>> {
  const parsed = createPublicLeadSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const input = parsed.data;

  // Honeypot: answer exactly as a success would, but write nothing. A distinct
  // error here would tell a bot which field to stop filling.
  if (input.hp_field) {
    return ok({ leadId: 'accepted', dedup: false });
  }

  const ipVerdict = await consumeRateLimit({
    scope: 'createLead_ip',
    identifier: context.ip,
    limit: RATE_LIMITS.perIpPerHour,
    windowMs: HOUR_MS,
  });
  if (!ipVerdict.allowed) {
    return rateLimitedError('Too many submissions from this network. Please try again later.');
  }

  const phoneVerdict = await consumeRateLimit({
    scope: 'createLead_phone',
    identifier: input.phone,
    limit: RATE_LIMITS.perPhonePerDay,
    windowMs: DAY_MS,
  });
  if (!phoneVerdict.allowed) {
    return rateLimitedError('This number has submitted several enquiries today.');
  }

  const db = adminDb();
  const now = new Date();

  try {
    const existing = await db.collection('leads').where('phone', '==', input.phone).limit(1).get();

    const previous = existing.docs[0];

    if (previous) {
      // Dedup path: the enquiry is never dropped — it becomes an activity on
      // the lead already in the pipeline, so the consultant sees the renewed
      // interest without a second record appearing (BR-01 pre-conversion).
      await previous.ref.update({
        updatedAt: now,
        updatedBy: 'system',
        // A returning enquirer is renewed interest; a lead marked lost is
        // reopened rather than left buried.
        ...(previous.get('stage') === 'lost' ? { stage: 'new', lostReason: null } : {}),
      });

      await previous.ref.collection('activities').add({
        type: 'note',
        summary: `Repeat website enquiry (${input.formType})${input.message ? `: ${input.message}` : ''}`,
        at: now,
        byUid: 'system',
      });

      await writeAudit({
        actorUid: 'system',
        actorRole: 'system',
        action: 'update',
        entityType: 'lead',
        entityId: previous.id,
        entityPath: `leads/${previous.id}`,
        context: { feature: 'leads', reason: 'BR-07 website dedup' },
      });

      return ok({ leadId: previous.id, dedup: true });
    }

    const ref = db.collection('leads').doc();
    await ref.set({
      schemaVersion: 1,
      // Single-branch today; ADR-010 keeps IDs branch-prefixable.
      branchId: 'main',
      name: input.name,
      phone: input.phone,
      email: input.email,
      source: 'website',
      sourceDetail: {
        formType: input.formType,
        ...(input.utm?.source ? { utmSource: input.utm.source } : {}),
        ...(input.utm?.medium ? { utmMedium: input.utm.medium } : {}),
        ...(input.utm?.campaign ? { utmCampaign: input.utm.campaign } : {}),
      },
      leadType: input.leadType,
      programmeInterestId: input.programmeInterestSlug,
      academyId: null,
      stage: 'new',
      assignedToUid: null,
      partnerId: null,
      nextFollowUpAt: null,
      lostReason: null,
      participantId: null,
      consent: { given: true, at: now, textVersion: input.consent.textVersion },
      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system',
      deletedAt: null,
      deletedBy: null,
    });

    // Lead history starts at creation so the trail is complete from first touch.
    await ref.collection('activities').add({
      type: 'note',
      summary: `Website enquiry received (${input.formType})${input.message ? `: ${input.message}` : ''}`,
      at: now,
      byUid: 'system',
    });

    await writeAudit({
      actorUid: 'system',
      actorRole: 'system',
      action: 'create',
      entityType: 'lead',
      entityId: ref.id,
      entityPath: `leads/${ref.id}`,
      changes: { source: { before: null, after: 'website' } },
      context: { feature: 'leads', reason: `website:${input.formType}` },
    });

    // BR-07: auto-acknowledgement to the registrant, logged like any other
    // message. Deliberately after the lead is committed — an acknowledgement
    // that fails must never cost us the enquiry itself.
    if (input.email) {
      await enqueueTemplatedMessage({
        templateKey: 'lead.enquiry_acknowledgement',
        refType: 'lead',
        refId: ref.id,
        branchId: 'main',
      }).catch(() => undefined);
    }

    return ok({ leadId: ref.id, dedup: false });
  } catch {
    return internalError('Could not record the enquiry. Please try again.');
  }
}
