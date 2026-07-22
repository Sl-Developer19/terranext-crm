import 'server-only';

import { findCounsellableLeads, findSessions, findSessionsForLead } from './repository';
import type { CounsellingLeadOption, CounsellingSession } from './schema';

/** Read models for counselling (S12). */

export async function listSessions(): Promise<CounsellingSession[]> {
  return findSessions();
}

export async function listSessionsForLead(leadId: string): Promise<CounsellingSession[]> {
  return findSessionsForLead(leadId);
}

export async function listCounsellableLeads(): Promise<CounsellingLeadOption[]> {
  return findCounsellableLeads();
}
