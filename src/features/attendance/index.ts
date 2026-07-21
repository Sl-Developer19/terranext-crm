/** Public API of the attendance feature (Doc 02 §3). */
export { AttendanceGrid } from './components/attendance-grid';
export { AttendanceSummary } from './components/attendance-summary';
export { getAttendanceGrid, getBatchAttendanceSummary, getParticipantAttendance } from './queries';
export { calculateAttendancePct } from './logic';
export {
  ATTENDANCE_STATUSES,
  type AttendanceRow,
  type AttendanceStatus,
  type ParticipantAttendanceEntry,
  type SessionAttendanceSummary,
} from './schema';
