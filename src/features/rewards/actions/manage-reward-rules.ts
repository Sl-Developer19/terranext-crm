'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import {
  createRewardRuleSchema,
  setRewardRuleActiveSchema,
  type CreateRewardRuleInput,
  type SetRewardRuleActiveInput,
} from '../schema';

/** Creates a reward rule (Doc 25 §3) — `rewards:configure`, System Admin only. */
export async function createRewardRule(
  input: CreateRewardRuleInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'rewards:configure')) return permissionError();

  const parsed = createRewardRuleSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const data = parsed.data;

  try {
    const ref = adminDb().collection('rewardRules').doc();
    const now = new Date();
    await ref.set({
      schemaVersion: 1,
      kind: data.kind,
      programmeId: data.programmeId,
      amountPaise: data.kind === 'flat' ? data.amountPaise : null,
      percentBps: data.kind === 'percent' ? data.percentBps : null,
      active: true,
      effectiveFrom: new Date(data.effectiveFrom),
      createdAt: now,
      createdBy: session.uid,
      updatedAt: now,
      updatedBy: session.uid,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'reward_rule',
      entityId: ref.id,
      entityPath: `rewardRules/${ref.id}`,
      context: { feature: 'rewards' },
    });

    return ok({ id: ref.id });
  } catch {
    return internalError('Could not create the reward rule. Please try again.');
  }
}

/** Activates/deactivates a reward rule — never edits the amount in place (Doc 25 §3). */
export async function setRewardRuleActive(
  input: SetRewardRuleActiveInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'rewards:configure')) return permissionError();

  const parsed = setRewardRuleActiveSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid input.' });
  const { ruleId, active } = parsed.data;

  const ref = adminDb().collection('rewardRules').doc(ruleId);
  const snap = await ref.get();
  if (!snap.exists) return notFoundError('Reward rule not found.');
  const before = snap.get('active') === true;

  await ref.update({ active, updatedAt: new Date(), updatedBy: session.uid });

  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'update',
    entityType: 'reward_rule',
    entityId: ruleId,
    entityPath: `rewardRules/${ruleId}`,
    changes: { active: { before, after: active } },
    context: { feature: 'rewards' },
  });

  return ok({ ok: true });
}
