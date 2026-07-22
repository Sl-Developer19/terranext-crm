import { ORGANISATION } from '@/config/organisation';

import type { Channel, RefType } from './schema';

/**
 * Built-in message templates. `settings/notificationTemplates` is a Phase 10
 * deliverable (Doc 14 §3); until it exists the catalogue lives in code, which
 * also keeps `templateKey` values stable for the log's history.
 *
 * Bodies carry no sender footer — the dispatcher appends it (Doc 24 §1), so
 * the contact number lives in exactly one place. Where a template invites the
 * reader to call, it interpolates from config rather than repeating a literal.
 */

export interface CommunicationTemplate {
  key: string;
  label: string;
  channel: Channel;
  refType: RefType;
  subject: string | null;
  body: string;
}

export const COMMUNICATION_TEMPLATES: readonly CommunicationTemplate[] = [
  {
    key: 'lead.enquiry_acknowledgement',
    label: 'Enquiry acknowledgement',
    channel: 'email',
    refType: 'lead',
    subject: 'We received your enquiry',
    body: `Thank you for your interest in ${ORGANISATION.senderName}. A counsellor will contact you within one working day to discuss the programmes that suit you best.\n\nIf you would rather speak to us now, call ${ORGANISATION.contactPhoneDisplay}.`,
  },
  {
    key: 'lead.counselling_invite',
    label: 'Counselling session invite',
    channel: 'email',
    refType: 'lead',
    subject: 'Your counselling session',
    body: `We would like to invite you to a counselling session to walk through programme options, fees and timelines. Please reply with a time that suits you, or call ${ORGANISATION.contactPhoneDisplay} to book one.`,
  },
  {
    key: 'participant.admission_confirmation',
    label: 'Admission confirmation',
    channel: 'email',
    refType: 'participant',
    subject: 'Your admission is confirmed',
    body: `Congratulations — your admission is confirmed. Your batch coordinator will share the schedule and joining details shortly.\n\nFor anything urgent before then, call ${ORGANISATION.contactPhoneDisplay}.`,
  },
  {
    key: 'participant.fee_reminder',
    label: 'Fee instalment reminder',
    channel: 'sms',
    refType: 'participant',
    subject: null,
    // SMS bodies stay terse: the dispatcher appends the sender signature, and
    // every extra character risks a second billed segment.
    body: `A fee instalment on your account is due. If you have already paid, call ${ORGANISATION.contactPhoneDisplay}.`,
  },
  {
    key: 'participant.attendance_shortfall',
    label: 'Attendance shortfall notice',
    channel: 'email',
    refType: 'participant',
    subject: 'Attendance shortfall',
    body: `Your attendance is currently below the level required for certification. Please speak to your coordinator so we can help you catch up, or call ${ORGANISATION.contactPhoneDisplay}.`,
  },
  {
    key: 'participant.certificate_issued',
    label: 'Certificate issued',
    channel: 'email',
    refType: 'participant',
    subject: 'Your certificate is ready',
    body: 'Congratulations on completing your programme. Your certificate has been issued and can be verified using the code on the document.',
  },
];

export function findTemplate(key: string): CommunicationTemplate | undefined {
  return COMMUNICATION_TEMPLATES.find((template) => template.key === key);
}

export function templatesFor(channel: Channel, refType: RefType): CommunicationTemplate[] {
  return COMMUNICATION_TEMPLATES.filter((t) => t.channel === channel && t.refType === refType);
}
