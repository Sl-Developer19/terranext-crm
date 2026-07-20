/** Public API of the leads feature (Doc 02 §3). */
export { CreateLeadDialog } from './components/create-lead-dialog';
export { LeadsTable } from './components/leads-table';
export { LeadDetailView } from './components/lead-detail-view';
export { listLeads, getLead, listLeadActivities, listConsultants } from './queries';
export {
  LEAD_SOURCES,
  LEAD_STAGES,
  LEAD_ACTIVITY_TYPES,
  createLeadSchema,
  updateLeadSchema,
  assignLeadSchema,
  logLeadActivitySchema,
  type Lead,
  type LeadActivity,
  type LeadSource,
  type LeadStage,
  type LeadActivityType,
  type CreateLeadInput,
  type UpdateLeadInput,
  type AssignLeadInput,
  type LogLeadActivityInput,
} from './schema';
