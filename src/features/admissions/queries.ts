import 'server-only';

import { br02Checklist, findSessionsByLead, listSessionsForLead } from '@/features/counselling';
import { adminDb } from '@/lib/firebase/admin';

import { ADMISSION_STAGES, sortCandidates } from './logic';
import { findDuplicatesByPhone, findLeadForConversion, findQueueLeads } from './repository';
import type { AdmissionCandidate, DuplicateMatch } from './schema';

/** Read models for the admissions queue and convert flow (S13/S14). */

export async function listAdmissionCandidates(): Promise<AdmissionCandidate[]> {
  const [leads, sessionsByLead, users] = await Promise.all([
    findQueueLeads(ADMISSION_STAGES),
    // One read for every lead's sessions, not one read per row.
    findSessionsByLead(),
    adminDb().collection('users').get(),
  ]);

  const userNames = new Map(
    users.docs.map((doc) => [doc.id, (doc.get('displayName') as string) ?? doc.id]),
  );

  const candidates = leads.map((lead): AdmissionCandidate => {
    const sessions = sessionsByLead.get(lead.id) ?? [];
    const checklist = br02Checklist(sessions);
    const recommending = sessions
      .slice()
      .sort((a, b) => b.heldAt.localeCompare(a.heldAt))
      .find((s) => s.recommendation);

    return {
      leadId: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      stage: lead.stage,
      source: lead.source,
      assignedToName: lead.assignedToUid ? (userNames.get(lead.assignedToUid) ?? null) : null,
      checklist,
      recommendedProgrammeName: recommending?.recommendation?.programmeName ?? null,
      updatedAt: lead.updatedAt,
    };
  });

  return sortCandidates(candidates);
}

export interface ConversionContext {
  lead: Awaited<ReturnType<typeof findLeadForConversion>>;
  checklist: ReturnType<typeof br02Checklist>;
  recommendedProgrammeId: string | null;
  recommendedProgrammeName: string | null;
  duplicates: DuplicateMatch[];
}

/** Everything the S14 stepper needs, gathered in one pass. */
export async function getConversionContext(leadId: string): Promise<ConversionContext | null> {
  const lead = await findLeadForConversion(leadId);
  if (!lead) return null;

  const sessions = await listSessionsForLead(leadId);
  const checklist = br02Checklist(sessions);
  const recommending = sessions.find((s) => s.recommendation);
  const duplicates = lead.phone ? await findDuplicatesByPhone(lead.phone) : [];

  return {
    lead,
    checklist,
    recommendedProgrammeId: recommending?.recommendation?.programmeId ?? null,
    recommendedProgrammeName: recommending?.recommendation?.programmeName ?? null,
    duplicates,
  };
}
