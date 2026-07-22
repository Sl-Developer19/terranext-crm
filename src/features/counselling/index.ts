/** Public API of the counselling feature (Doc 02 §3). */
export { SessionFormDialog } from './components/session-form-dialog';
export { SessionsView } from './components/sessions-view';
export { br02Checklist, canConvertLead, recommendingSession, type Br02Checklist } from './logic';
export { listCounsellableLeads, listSessions, listSessionsForLead } from './queries';
export { findSessionsByLead } from './repository';
export type { CounsellingSession } from './schema';
