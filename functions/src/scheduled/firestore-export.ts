import { GoogleAuth } from 'google-auth-library';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';

import { reportFunctionError } from '../observability/report-error';
import { writeSystemEvent } from '../lib/system-events';

/**
 * Weekly Firestore export to Cloud Storage (Doc 23 §3 binding amendment:
 * "enable Firestore PITR + weekly export-to-bucket from day one" — PITR
 * covers the last 7 days continuously, this export is the longer-horizon,
 * off-project-recovery backup, Doc 22 M1).
 *
 * Uses the Firestore Admin REST API directly (`:exportDocuments`) — the
 * Admin SDK client library does not wrap this endpoint. Authenticates via
 * Application Default Credentials (the Functions runtime's own service
 * account), which must hold `datastore.exportDocuments` (the
 * `roles/datastore.importExportAdmin` predefined role) and the target
 * bucket must grant that same identity `storage.objectAdmin` — a one-time
 * manual grant (Doc 19 §4, IAM is not something this Function can grant to
 * itself).
 */

const EXPORT_BUCKET = defineString('FIRESTORE_EXPORT_BUCKET');

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] });

export const scheduledFirestoreExport = onSchedule(
  { schedule: '0 2 * * 0', timeZone: 'Asia/Kolkata', retryCount: 2 },
  async () => {
    const projectId = process.env.GCLOUD_PROJECT;
    const bucket = EXPORT_BUCKET.value();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
      const client = await auth.getClient();
      const response = await client.request({
        url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
        method: 'POST',
        data: {
          outputUriPrefix: `gs://${bucket}/scheduled/${timestamp}`,
        },
      });
      logger.info('Firestore export started', { response: response.data });
    } catch (error) {
      reportFunctionError(error, 'scheduledFirestoreExport');
      await writeSystemEvent({
        source: 'scheduledFirestoreExport',
        message: 'Weekly Firestore export failed to start',
        detail: { error: error instanceof Error ? error.message : String(error) },
      });
      // Re-throw so the scheduler's own retry (retryCount above) also engages.
      throw error;
    }
  },
);
