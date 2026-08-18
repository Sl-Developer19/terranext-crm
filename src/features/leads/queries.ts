import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot, DocumentSnapshot } from 'firebase-admin/firestore';

import type { Session } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { resolveDisplayNames } from '@/lib/firebase/resolve-display-names';

import { isLeadRowScoped } from './logic';
import type { Lead, LeadActivity } from './schema';

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

async function resolveProgrammeNames(ids: unknown[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => typeof v === 'string'))];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const snap = await adminDb().collection('programmes').doc(id).get();
      map.set(id, typeof snap.get('name') === 'string' ? (snap.get('name') as string) : id);
    }),
  );
  return map;
}

/**
 * Doc 25 / TCGN — partner displayName lookup for the "Referred by" column.
 * `partnerId` can belong to either `growthPartners` (individual) or
 * `communityPartners` (business) — a single Firebase-style id space, two
 * possible collections (ADR-014) — so this tries the individual collection
 * first, then the business one, same order and shape as
 * `findPartnerDocByAuthUid` in `lib/auth/partner-login-runtime.ts`. Before
 * this fix, a TCGN-referred lead resolved to nothing here and fell back to
 * showing the raw partner id instead of the business's name.
 */
async function resolvePartnerNames(ids: unknown[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => typeof v === 'string'))];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const gpSnap = await adminDb().collection('growthPartners').doc(id).get();
      if (gpSnap.exists) {
        const name = gpSnap.get('displayName');
        map.set(id, typeof name === 'string' ? name : id);
        return;
      }
      const cpSnap = await adminDb().collection('communityPartners').doc(id).get();
      if (cpSnap.exists) {
        const name = cpSnap.get('orgName');
        map.set(id, typeof name === 'string' ? name : id);
        return;
      }
      map.set(id, id);
    }),
  );
  return map;
}

function toLead(
  doc: QueryDocumentSnapshot | DocumentSnapshot,
  names: Map<string, string>,
  programmeNames: Map<string, string>,
  partnerNames: Map<string, string>,
): Lead {
  const data = doc.data() ?? {};
  const assignedToUid = typeof data.assignedToUid === 'string' ? data.assignedToUid : null;
  const partnerId = typeof data.partnerId === 'string' ? data.partnerId : null;
  const programmeInterest =
    typeof data.programmeInterestId === 'string' ? data.programmeInterestId : null;
  return {
    id: doc.id,
    name: typeof data.name === 'string' ? data.name : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    email: typeof data.email === 'string' ? data.email : null,
    source: data.source,
    programmeInterest,
    programmeInterestName: programmeInterest
      ? (programmeNames.get(programmeInterest) ?? programmeInterest)
      : null,
    stage: data.stage,
    assignedToUid,
    assignedToName: assignedToUid ? (names.get(assignedToUid) ?? null) : null,
    partnerId,
    partnerName: partnerId ? (partnerNames.get(partnerId) ?? null) : null,
    leadType: typeof data.leadType === 'string' ? (data.leadType as Lead['leadType']) : null,
    nextFollowUpAt: toIso(data.nextFollowUpAt),
    lostReason: typeof data.lostReason === 'string' ? data.lostReason : null,
    participantId: typeof data.participantId === 'string' ? data.participantId : null,
    consentGiven: data.consent?.given === true,
    createdAt: toIso(data.createdAt) ?? '',
    updatedAt: toIso(data.updatedAt) ?? '',
  };
}

/** Directory reads are bounded — an unbounded org-wide scan is a real perf risk at scale. */
export const LEADS_SCAN_CAP = 500;

/**
 * Directory read for /leads (Doc 16 S10). Row-level scope (Doc 10 §2):
 * consultants see only leads assigned to them; ops_manager/founder see all.
 */
export async function listLeads(session: Session): Promise<Lead[]> {
  const base = adminDb().collection('leads').where('deletedAt', '==', null);
  const query =
    session.role === 'consultant'
      ? base.where('assignedToUid', '==', session.uid).orderBy('updatedAt', 'desc')
      : base.orderBy('updatedAt', 'desc');

  const snap = await query.limit(LEADS_SCAN_CAP).get();
  const [names, programmeNames, partnerNames] = await Promise.all([
    resolveDisplayNames(snap.docs.map((d) => d.get('assignedToUid') as unknown)),
    resolveProgrammeNames(snap.docs.map((d) => d.get('programmeInterestId') as unknown)),
    resolvePartnerNames(snap.docs.map((d) => d.get('partnerId') as unknown)),
  ]);
  return snap.docs.map((doc) => toLead(doc, names, programmeNames, partnerNames));
}

/** Single-lead read for /leads/[leadId] (Doc 16 S11), row-scoped like listLeads. */
export async function getLead(session: Session, leadId: string): Promise<Lead | null> {
  const snap = await adminDb().collection('leads').doc(leadId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data || data.deletedAt !== null) return null;
  const assignedToUid = typeof data.assignedToUid === 'string' ? data.assignedToUid : null;
  if (isLeadRowScoped(session.role, assignedToUid, session.uid)) return null;

  const [names, programmeNames, partnerNames] = await Promise.all([
    resolveDisplayNames([assignedToUid]),
    resolveProgrammeNames([data.programmeInterestId]),
    resolvePartnerNames([data.partnerId]),
  ]);
  return toLead(snap, names, programmeNames, partnerNames);
}

/**
 * Doc 25 §4 — a Growth Partner's own referred leads, strictly row-scoped by
 * `partnerId`. There is no staff-role branch here: this function is only
 * ever called with a `PartnerSession`, never a staff `Session`.
 */
export async function listPartnerLeads(partnerId: string): Promise<Lead[]> {
  const snap = await adminDb()
    .collection('leads')
    .where('partnerId', '==', partnerId)
    .where('deletedAt', '==', null)
    .orderBy('updatedAt', 'desc')
    .limit(LEADS_SCAN_CAP)
    .get();

  const [names, programmeNames, partnerNames] = await Promise.all([
    resolveDisplayNames(snap.docs.map((d) => d.get('assignedToUid') as unknown)),
    resolveProgrammeNames(snap.docs.map((d) => d.get('programmeInterestId') as unknown)),
    resolvePartnerNames([partnerId]),
  ]);
  return snap.docs.map((doc) => toLead(doc, names, programmeNames, partnerNames));
}

/** Single-lead read for a partner's own lead, row-scoped by `partnerId` — returns
 * null (never another partner's data, per Doc 25 §16) if the lead isn't theirs. */
export async function getPartnerLead(partnerId: string, leadId: string): Promise<Lead | null> {
  const snap = await adminDb().collection('leads').doc(leadId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data || data.deletedAt !== null || data.partnerId !== partnerId) return null;

  const [names, programmeNames, partnerNames] = await Promise.all([
    resolveDisplayNames([data.assignedToUid]),
    resolveProgrammeNames([data.programmeInterestId]),
    resolvePartnerNames([partnerId]),
  ]);
  return toLead(snap, names, programmeNames, partnerNames);
}

export async function listLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const snap = await adminDb()
    .collection('leads')
    .doc(leadId)
    .collection('activities')
    .orderBy('at', 'desc')
    .get();

  const names = await resolveDisplayNames(snap.docs.map((d) => d.get('byUid') as unknown));
  return snap.docs.map((doc) => {
    const data = doc.data();
    const byUid = typeof data.byUid === 'string' ? data.byUid : '';
    return {
      id: doc.id,
      type: data.type,
      summary: typeof data.summary === 'string' ? data.summary : '',
      at: toIso(data.at) ?? '',
      byUid,
      byName: names.get(byUid) ?? 'Unknown',
    };
  });
}

/** Assignable consultants for the assignment dialog (ops_manager/founder only). */
export async function listConsultants(): Promise<Array<{ uid: string; displayName: string }>> {
  const snap = await adminDb()
    .collection('users')
    .where('role', '==', 'consultant')
    .where('status', '==', 'active')
    .where('deletedAt', '==', null)
    .get();
  return snap.docs.map((doc) => ({
    uid: doc.id,
    displayName:
      typeof doc.get('displayName') === 'string' ? (doc.get('displayName') as string) : doc.id,
  }));
}
