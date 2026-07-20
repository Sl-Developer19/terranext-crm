import type { StaffRole } from '@/types/common';

/** Human-readable role names (BRD §18 titles) — display only, never an authorization input. */
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  founder: 'Founder & Proprietor',
  system_admin: 'System Administrator',
  ops_manager: 'Operations Manager',
  consultant: 'Transformation Consultant',
  coordinator: 'Programme Coordinator',
  trainer: 'Trainer',
  finance: 'Finance Officer',
  placement: 'Career & Placement Officer',
};
