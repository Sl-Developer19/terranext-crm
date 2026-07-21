import 'server-only';

import { filterCommunications } from './logic';
import { findCommunications, findRecipientOptions } from './repository';
import type { Communication, CommunicationFilter, RecipientOption } from './schema';

/** Read models for the communications log (S41). */

export async function listCommunications(
  filter: CommunicationFilter = {},
): Promise<Communication[]> {
  const rows = await findCommunications();
  return filterCommunications(rows, filter);
}

export async function listRecipientOptions(): Promise<RecipientOption[]> {
  return findRecipientOptions();
}
