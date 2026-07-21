/** Public API of the communications feature (Doc 02 §3). */
export { CommunicationsLog } from './components/communications-log';
export { LogCommunicationDialog } from './components/log-communication-dialog';
export { SendCommunicationDialog } from './components/send-communication-dialog';
export { listCommunications, listRecipientOptions } from './queries';
export type { Communication, RecipientOption } from './schema';
