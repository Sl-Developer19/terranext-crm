/** Public API of the communications feature (Doc 02 §3). */
export { CommunicationsLog } from './components/communications-log';
export { LogCommunicationDialog } from './components/log-communication-dialog';
export { RecordCommunications } from './components/record-communications';
export { SendCommunicationDialog } from './components/send-communication-dialog';
export { listCommunications, listCommunicationsFor, listRecipientOptions } from './queries';
export type { Communication, RecipientOption } from './schema';
