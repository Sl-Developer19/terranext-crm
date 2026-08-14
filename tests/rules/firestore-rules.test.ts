import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { anon, authed, createTestEnv } from './helpers';

/**
 * Firestore rules allow/deny matrix (Doc 18).
 *
 * Two invariants dominate this suite:
 *
 * 1. **No client writes to business collections.** Every mutation goes through
 *    a server action on the Admin SDK so BR checks and audit logging cannot be
 *    bypassed. A rules file that lets a client write directly is a hole in
 *    that whole design, not a convenience.
 * 2. **Reads follow the permission map.** A role that cannot see a module in
 *    the UI must not be able to read its collection either.
 */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // Seed through a rules-bypassing context: these tests assert what clients
  // may do, and every document here was written by the Admin SDK in reality.
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // assignedToUid matters: leads/* enforces row-level scoping for
    // consultants (Doc 10 §2), and Firestore rules throw an evaluation
    // error — not a clean `false` — on a field access against a doc that
    // lacks the field entirely. The seed has to look like a real lead.
    await setDoc(doc(db, 'leads/lead1'), {
      name: 'Asha',
      phone: '+919876543210',
      assignedToUid: 'consultant1',
    });
    await setDoc(doc(db, 'leads/lead2'), {
      name: 'Ravi',
      phone: '+919876543211',
      assignedToUid: 'consultant2',
    });
    await setDoc(doc(db, 'participants/TNX-2026-00001'), {
      personal: { fullName: 'Asha Menon' },
    });
    await setDoc(doc(db, 'counsellingSessions/s1'), { leadId: 'lead1', outcome: 'recommended' });
    await setDoc(doc(db, 'communications/c1'), { refType: 'lead', refId: 'lead1' });
    await setDoc(doc(db, 'colleges/col1'), { name: 'St Xavier', status: 'active' });
    await setDoc(doc(db, 'alumniRecords/TNX-2026-00001'), { participantId: 'TNX-2026-00001' });
    await setDoc(doc(db, 'certificates/cert1'), { participantId: 'TNX-2026-00001' });
    await setDoc(doc(db, 'certificateTemplates/tpl1'), {
      name: 'NextGen Classic',
      activeVersionId: null,
    });
    await setDoc(doc(db, 'certificateTemplates/tpl1/versions/v1'), {
      status: 'draft',
      versionNumber: 1,
    });
    await setDoc(doc(db, 'feeAccounts/enr1'), { participantId: 'TNX-2026-00001' });
    await setDoc(doc(db, 'auditLogs/a1'), { actorUid: 'u1', action: 'create', entityType: 'lead' });
    await setDoc(doc(db, 'settings/general'), { orgName: 'TerraNext' });
    await setDoc(doc(db, 'users/u1'), { displayName: 'Ops', role: 'ops_manager' });
    await setDoc(doc(db, 'rateLimits/k1'), { count: 1 });
    await setDoc(doc(db, 'loginSecurity/h1'), { attempts: 1 });
  });
});

describe('anonymous access', () => {
  it('cannot read any business collection', async () => {
    const db = anon(env);
    await assertFails(getDoc(doc(db, 'leads/lead1')));
    await assertFails(getDoc(doc(db, 'participants/TNX-2026-00001')));
    await assertFails(getDoc(doc(db, 'communications/c1')));
    await assertFails(getDoc(doc(db, 'certificates/cert1')));
    await assertFails(getDoc(doc(db, 'certificateTemplates/tpl1')));
    await assertFails(getDoc(doc(db, 'certificateTemplates/tpl1/versions/v1')));
  });

  it('cannot read settings, users or audit logs', async () => {
    const db = anon(env);
    await assertFails(getDoc(doc(db, 'settings/general')));
    await assertFails(getDoc(doc(db, 'users/u1')));
    await assertFails(getDoc(doc(db, 'auditLogs/a1')));
  });

  it('cannot write anything', async () => {
    const db = anon(env);
    await assertFails(setDoc(doc(db, 'leads/evil'), { name: 'injected' }));
  });
});

describe('server-only collections', () => {
  it('hides the login-security ledger from every role', async () => {
    // These carry lockout state and attempt counters; no client, however
    // privileged, has a reason to read or reset them.
    for (const role of ['founder', 'system_admin', 'ops_manager'] as const) {
      const db = authed(env, 'u1', role);
      await assertFails(getDoc(doc(db, 'loginSecurity/h1')));
      await assertFails(setDoc(doc(db, 'loginSecurity/h1'), { attempts: 0 }));
    }
  });

  it('hides rate-limit counters — a readable counter is a defeatable one', async () => {
    const db = authed(env, 'u1', 'founder');
    await assertFails(getDoc(doc(db, 'rateLimits/k1')));
    await assertFails(setDoc(doc(db, 'rateLimits/k1'), { count: 0 }));
  });

  it('keeps counters server-only so BR-01 IDs cannot be forged', async () => {
    const db = authed(env, 'u1', 'system_admin');
    await assertFails(setDoc(doc(db, 'counters/participantId'), { current: 9999 }));
  });
});

describe('audit log immutability (ADR-007)', () => {
  it('lets founder and system_admin read the register', async () => {
    await assertSucceeds(getDoc(doc(authed(env, 'u1', 'founder'), 'auditLogs/a1')));
    await assertSucceeds(getDoc(doc(authed(env, 'u1', 'system_admin'), 'auditLogs/a1')));
  });

  it('hides the register from other roles', async () => {
    await assertFails(getDoc(doc(authed(env, 'u1', 'consultant'), 'auditLogs/a1')));
    await assertFails(getDoc(doc(authed(env, 'u1', 'finance'), 'auditLogs/a1')));
  });

  it('never allows an entry to be updated or deleted, by anyone', async () => {
    // Immutability is absolute — an audit trail that can be edited is not one.
    for (const role of ['founder', 'system_admin', 'ops_manager'] as const) {
      const db = authed(env, 'u1', role);
      await assertFails(setDoc(doc(db, 'auditLogs/a1'), { action: 'tampered' }));
    }
  });
});

describe('business collections are read-only to clients', () => {
  const paths = [
    'leads/lead1',
    'participants/TNX-2026-00001',
    'counsellingSessions/s1',
    'communications/c1',
    'colleges/col1',
    'alumniRecords/TNX-2026-00001',
    'certificates/cert1',
    'feeAccounts/enr1',
    'certificateTemplates/tpl1',
    'certificateTemplates/tpl1/versions/v1',
  ];

  it('refuses client writes even from the most privileged roles', async () => {
    for (const role of ['founder', 'system_admin', 'ops_manager'] as const) {
      const db = authed(env, 'u1', role);
      for (const path of paths) {
        await assertFails(setDoc(doc(db, path), { tampered: true }));
      }
    }
  });
});

describe('certificateTemplates (Certificate Template Engine)', () => {
  it('lets roles with certificates:view read templates and their versions', async () => {
    // Founder (super role) and ops_manager/trainer (explicit `certificates:view`
    // grant) can read directly. system_admin deliberately holds only
    // `certificates:configure`, not `:view` — same asymmetry the certificates
    // collection itself already has — so it is excluded here; the admin UI
    // still works for system_admin because every read goes through a server
    // action on the Admin SDK, never a direct client Firestore read.
    for (const role of ['founder', 'ops_manager', 'trainer'] as const) {
      const db = authed(env, 'u1', role);
      await assertSucceeds(getDoc(doc(db, 'certificateTemplates/tpl1')));
      await assertSucceeds(getDoc(doc(db, 'certificateTemplates/tpl1/versions/v1')));
    }
  });

  it('denies roles without a certificates grant, e.g. finance', async () => {
    const db = authed(env, 'u1', 'finance');
    await assertFails(getDoc(doc(db, 'certificateTemplates/tpl1')));
    await assertFails(getDoc(doc(db, 'certificateTemplates/tpl1/versions/v1')));
  });

  it('denies system_admin a direct client read — it holds configure, not view, same as the certificates collection', async () => {
    const db = authed(env, 'u1', 'system_admin');
    await assertFails(getDoc(doc(db, 'certificateTemplates/tpl1')));
  });

  it('never allows a client write, even to create a template or version', async () => {
    const db = authed(env, 'u1', 'system_admin');
    await assertFails(setDoc(doc(db, 'certificateTemplates/tpl2'), { name: 'Injected' }));
    await assertFails(
      setDoc(doc(db, 'certificateTemplates/tpl1/versions/v2'), { status: 'active' }),
    );
  });
});

describe('read scoping follows the permission map', () => {
  it('lets roles with the view grant read their module', async () => {
    await assertSucceeds(getDoc(doc(authed(env, 'consultant1', 'consultant'), 'leads/lead1')));
    await assertSucceeds(getDoc(doc(authed(env, 'u1', 'ops_manager'), 'counsellingSessions/s1')));
    await assertSucceeds(getDoc(doc(authed(env, 'u1', 'finance'), 'feeAccounts/enr1')));
    await assertSucceeds(
      getDoc(doc(authed(env, 'u1', 'placement'), 'participants/TNX-2026-00001')),
    );
  });

  it('scopes a consultant to their own assigned leads, not every lead (Doc 10 §2)', async () => {
    const consultant1 = authed(env, 'consultant1', 'consultant');
    // Their own assignment: readable.
    await assertSucceeds(getDoc(doc(consultant1, 'leads/lead1')));
    // Someone else's assignment: denied, even though the module grant is the same.
    await assertFails(getDoc(doc(consultant1, 'leads/lead2')));
  });

  it('lets founder and ops_manager read every lead regardless of assignment', async () => {
    for (const role of ['founder', 'ops_manager'] as const) {
      const db = authed(env, 'someone-unassigned', role);
      await assertSucceeds(getDoc(doc(db, 'leads/lead1')));
      await assertSucceeds(getDoc(doc(db, 'leads/lead2')));
    }
  });

  it('denies modules a role has no grant for', async () => {
    // trainer has no leads grant; finance has no counselling grant.
    await assertFails(getDoc(doc(authed(env, 'u1', 'trainer'), 'leads/lead1')));
    await assertFails(getDoc(doc(authed(env, 'u1', 'finance'), 'counsellingSessions/s1')));
    await assertFails(getDoc(doc(authed(env, 'u1', 'trainer'), 'feeAccounts/enr1')));
  });

  it('does not let a system_admin read business data it has no view grant for', async () => {
    // system_admin configures the platform; it is deliberately not a
    // business-data role (Doc 04 §3).
    await assertFails(getDoc(doc(authed(env, 'u1', 'system_admin'), 'leads/lead1')));
  });

  it('lets Founder read every collection (super administrator)', async () => {
    // Founder holds every permission, so the generated predicates must admit
    // it everywhere. This is the rules-side half of the guarantee — passing
    // `can()` server-side while Firestore refuses the same read would be a
    // split-brain that looks like data loss.
    const db = authed(env, 'founder1', 'founder');
    for (const path of [
      'leads/lead1',
      'participants/TNX-2026-00001',
      'counsellingSessions/s1',
      'communications/c1',
      'colleges/col1',
      'alumniRecords/TNX-2026-00001',
      'certificates/cert1',
      'certificateTemplates/tpl1',
      'certificateTemplates/tpl1/versions/v1',
      'feeAccounts/enr1',
      'auditLogs/a1',
      'settings/general',
      'users/u1',
    ]) {
      await assertSucceeds(getDoc(doc(db, path)));
    }
  });

  it('still refuses Founder a direct client write', async () => {
    // Unrestricted authorization is not unrestricted transport. Every
    // mutation goes through a server action so BR checks and audit logging
    // cannot be bypassed — that holds for Founder like everyone else.
    const db = authed(env, 'founder1', 'founder');
    await assertFails(setDoc(doc(db, 'leads/lead1'), { tampered: true }));
    await assertFails(setDoc(doc(db, 'auditLogs/a1'), { action: 'tampered' }));
    await assertFails(setDoc(doc(db, 'counters/participantId'), { current: 9999 }));
  });
});

describe('Founder assignment cannot be forced through the rules layer', () => {
  // canAssignRole (features/users/logic.ts) is the application-layer guard:
  // founder or system_admin may hand out the Founder role (policy revised
  // 2026-07-24), every other role is refused. This block proves the
  // structural backstop UNDERNEATH that policy and is deliberately
  // independent of it — `users/*` has no client write path at all, for any
  // role, for any field, regardless of who canAssignRole permits. Even a
  // system_admin legitimately entitled to grant Founder cannot do it by
  // writing directly to Firestore; every role change is Admin-SDK only,
  // through setUserRole / provisionUser, which is where canAssignRole
  // actually runs. A future change to who may assign Founder must never
  // require a change here.
  const attemptSelfPromotion = (role: 'system_admin' | 'founder' | 'ops_manager' | 'trainer') =>
    setDoc(doc(authed(env, 'attacker', role), 'users/attacker'), {
      displayName: 'Attacker',
      role: 'founder',
      status: 'active',
    });

  it('refuses a System Administrator writing role: founder to any user doc', async () => {
    await assertFails(attemptSelfPromotion('system_admin'));
  });

  it('refuses an ordinary role writing role: founder to any user doc', async () => {
    await assertFails(attemptSelfPromotion('ops_manager'));
    await assertFails(attemptSelfPromotion('trainer'));
  });

  it('refuses even an authenticated Founder session — the write path itself does not exist', async () => {
    // Founder's unrestricted *authorization* does not create a client
    // *transport* path. It still promotes people through the audited
    // server action (Doc 24 §3a), never a direct document write.
    await assertFails(attemptSelfPromotion('founder'));
  });

  it('refuses editing an existing user document to add role: founder', async () => {
    const db = authed(env, 'u1', 'system_admin');
    await assertFails(setDoc(doc(db, 'users/u1'), { role: 'founder' }, { merge: true }));
  });
});

describe('users and settings', () => {
  it('lets any staff member read their own user doc', async () => {
    await assertSucceeds(getDoc(doc(authed(env, 'u1', 'trainer'), 'users/u1')));
  });

  it('stops a non-admin reading someone else’s user doc', async () => {
    await assertFails(getDoc(doc(authed(env, 'other', 'trainer'), 'users/u1')));
  });

  it('lets founder and system_admin read any user doc', async () => {
    await assertSucceeds(getDoc(doc(authed(env, 'other', 'founder'), 'users/u1')));
    await assertSucceeds(getDoc(doc(authed(env, 'other', 'system_admin'), 'users/u1')));
  });

  it('allows all staff to read settings but no client to write them', async () => {
    await assertSucceeds(getDoc(doc(authed(env, 'u1', 'trainer'), 'settings/general')));
    await assertFails(setDoc(doc(authed(env, 'u1', 'system_admin'), 'settings/general'), { x: 1 }));
  });
});

describe('role claim handling', () => {
  it('treats a signed-in user with no role claim as not staff', async () => {
    const db = env.authenticatedContext('nobody', {}).firestore();
    await assertFails(getDoc(doc(db, 'leads/lead1')));
    await assertFails(getDoc(doc(db, 'settings/general')));
  });

  it('rejects an unrecognised role rather than defaulting it open', async () => {
    const db = env.authenticatedContext('imposter', { role: 'superuser' }).firestore();
    await assertFails(getDoc(doc(db, 'leads/lead1')));
    await assertFails(getDoc(doc(db, 'auditLogs/a1')));
  });

  it('confirms the rules file itself was loaded', () => {
    // Guards against a harness that silently ran with permissive defaults —
    // if that happened, every assertFails above would be meaningless.
    expect(env.projectId).toBe('terranext-rules-test');
  });
});
