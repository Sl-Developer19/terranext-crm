/** Public API of the participants feature (Doc 02 §3). */
export { CreateParticipantDialog } from './components/create-participant-dialog';
export { ParticipantFilters } from './components/participant-filters';
export { ParticipantProfile } from './components/participant-profile';
export { ParticipantsTable } from './components/participants-table';
export {
  getParticipant,
  listDocuments,
  listEnrolments,
  listParticipants,
  listTimeline,
} from './queries';
export {
  DOCUMENT_KINDS,
  ENROLMENT_STATUSES,
  PARTICIPANT_STATUSES,
  participantFiltersSchema,
  type Enrolment,
  type Participant,
  type ParticipantDocument,
  type ParticipantFilters as ParticipantFilterValues,
  type ParticipantListItem,
  type ParticipantStatus,
  type TimelineEntry,
} from './schema';
