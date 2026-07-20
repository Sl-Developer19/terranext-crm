/**
 * Cloud Functions entry point — TerraNext Business OS.
 *
 * Function inventory and contracts: docs/19, docs/20.
 * Region policy: all functions deploy to asia-south1 (Doc 19).
 *
 * Functions are exported here as they land per the M1+ plan:
 * user provisioning (provisionUser, setUserRole, setUserStatus) arrives with
 * the RBAC foundation; createLead with Milestone 2.
 */
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });

export { scheduledFirestoreExport } from './scheduled/firestore-export';
