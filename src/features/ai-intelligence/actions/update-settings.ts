'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { saveAiSettings } from '../repository';
import { updateAiSettingsSchema, type UpdateAiSettingsInput } from '../schema';

/** Module configuration surface (/ai/settings). Provider selection itself is
 * env-controlled (`AI_SPEECH_PROVIDER` / `AI_SUMMARY_PROVIDER`, see
 * functions/src/ai/providers) — this action only touches operational
 * toggles that are safe to change without a redeploy. */
export async function updateAiSettings(input: UpdateAiSettingsInput): Promise<Result<void>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:configure')) return permissionError();

  const parsed = updateAiSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return validationError(fields);
  }

  try {
    await saveAiSettings(parsed.data, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'ai_intelligence_settings',
      entityId: 'config',
      entityPath: 'aiIntelligenceSettings/config',
      context: { feature: 'ai-intelligence' },
    });

    return ok(undefined);
  } catch {
    return internalError('Could not save settings. Please try again.');
  }
}
