/** Public API of the leads feature (Doc 02 §3). */
export { CreateLeadDialog } from './components/create-lead-dialog';
export { LeadsTable } from './components/leads-table';
export { LeadDetailView } from './components/lead-detail-view';
export { PartnerLeadsTable } from './components/partner-leads-table';
export { CreatePartnerLeadDialog } from './components/create-partner-lead-dialog';
export { LeadTimeline } from './components/lead-timeline';
export {
  listLeads,
  getLead,
  listLeadActivities,
  listConsultants,
  listPartnerLeads,
  getPartnerLead,
  LEADS_SCAN_CAP,
} from './queries';
export { computeLeadTimeline, type TimelineStep, type TimelineStepStatus } from './logic';
export {
  LEAD_SOURCES,
  LEAD_STAGES,
  LEAD_ACTIVITY_TYPES,
  LEAD_TYPES,
  createLeadSchema,
  updateLeadSchema,
  assignLeadSchema,
  logLeadActivitySchema,
  createPartnerLeadSchema,
  type Lead,
  type LeadActivity,
  type LeadSource,
  type LeadStage,
  type LeadActivityType,
  type LeadType,
  type CreateLeadInput,
  type UpdateLeadInput,
  type AssignLeadInput,
  type LogLeadActivityInput,
  type CreatePartnerLeadInput,
} from './schema';
