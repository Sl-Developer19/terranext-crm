import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { findCommunityPartnerByHumanId } from '@/features/community-partners';
import { findGrowthPartnerByHumanId } from '@/features/growth-partners';
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
 *
 * TCGN QR Referral System (Feature 6) extends this with one more rule of the
 * same shape: an unresolvable or inactive `referralCode` never blocks the
 * enquiry either — it just means no referral credit is attributed. The
 * dedup-update branch below is untouched by referral attribution entirely
 * (see the comment on that branch) — attribution only ever happens on a
 * genuinely new lead.
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

  // Referral Code Resolution (TCGN Feature 6; extended to individual Growth
  // Partners) — an unknown code or a known-but-inactive partner (Inactive
  // Partner Handling) both resolve to "no attribution", never an error
  // (Invalid QR Handling). Resolved once, up front, so both the lead write
  // and the referral-count increment below see the exact same partner.
  // Community Partner codes are checked first (matches the `TCGN-` prefix
  // dispatch in `/r/[code]/route.ts`) — a code only ever belongs to one
  // partner kind, so this never double-attributes.
  let referredPartner: {
    id: string;
    name: string;
    collection: 'communityPartners' | 'growthPartners';
  } | null = null;
  if (input.referralCode) {
    const community = await findCommunityPartnerByHumanId(input.referralCode).catch(() => null);
    if (community && community.status === 'active') {
      referredPartner = {
        id: community.id,
        name: community.orgName,
        collection: 'communityPartners',
      };
    } else {
      const growth = await findGrowthPartnerByHumanId(input.referralCode).catch(() => null);
      if (growth && growth.status === 'active') {
        referredPartner = { id: growth.id, name: growth.displayName, collection: 'growthPartners' };
      }
    }
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
      // Deliberately does not touch `partnerId`/`partnerName` even when this
      // submission carried a (possibly different) referral code: an existing
      // pipeline lead is not retroactively re-attributed by a repeat form
      // submission — that would let attribution be gamed by resubmitting
      // through a different partner's QR code, and reward eligibility must
      // reflect who actually generated the enquiry (Duplicate scans must
      // not create duplicate leads — or duplicate/shifted referral credit).
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
    const leadFields = {
      schemaVersion: 1,
      // Single-branch today; ADR-010 keeps IDs branch-prefixable.
      branchId: 'main',
      name: input.name,
      phone: input.phone,
      email: input.email,
      // Lead Attribution (TCGN Feature 6): a resolved referral genuinely is
      // a referral-sourced enquiry, regardless of which website form
      // carried it — `sourceDetail.formType` still records which form.
      source: referredPartner ? ('referral' as const) : ('website' as const),
      sourceDetail: {
        formType: input.formType,
        ...(input.sourcePage ? { sourcePage: input.sourcePage } : {}),
        ...(input.utm?.source ? { utmSource: input.utm.source } : {}),
        ...(input.utm?.medium ? { utmMedium: input.utm.medium } : {}),
        ...(input.utm?.campaign ? { utmCampaign: input.utm.campaign } : {}),
      },
      leadType: input.leadType,
      programmeInterestId: input.programmeInterestSlug,
      academyId: null,
      stage: 'new',
      assignedToUid: null,
      partnerId: referredPartner?.id ?? null,
      partnerName: referredPartner?.name ?? null,
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
    };

    if (referredPartner) {
      // Referral Count Update (TCGN Feature 6): the count moves inside the
      // same transaction as the lead it's counting — never a bare counter
      // write — so it can never drift from the leads that actually exist,
      // same posture as `wallets.balancePaise` (Doc 25 §12).
      const partnerRef = db.collection(referredPartner.collection).doc(referredPartner.id);
      await db.runTransaction(async (tx) => {
        tx.set(ref, leadFields);
        tx.set(partnerRef, { referralCount: FieldValue.increment(1) }, { merge: true });
      });
    } else {
      await ref.set(leadFields);
    }

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
      changes: { source: { before: null, after: leadFields.source } },
      context: {
        feature: 'leads',
        reason: referredPartner
          ? `website:${input.formType}:referral`
          : `website:${input.formType}`,
      },
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
