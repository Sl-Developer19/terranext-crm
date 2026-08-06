# Engineering 02 — AI Intelligence Platform: Developer Guide

**Document version:** 1.3
**Last reviewed:** 2026-08-05
**Audience:** Engineers implementing changes to this module
**Companion documents:** [01 — Technical Architecture](01-technical-architecture.md) · [03 — API & AI Workflow Guide](03-api-workflow-guide.md) · [04 — Known Limitations & Engineering Notes](04-known-limitations-and-engineering-notes.md)

Read [01 — Technical Architecture Guide](01-technical-architecture.md) first for the big picture; this document is the file-by-file, field-by-field reference for actually touching the code. Every function/field/constant name below is quoted exactly as it appears in the source.

---

## 1. File map

| File | Responsibility |
|---|---|
| `src/features/ai-intelligence/schema.ts` | Zod input schemas, string-union constants (`SESSION_STATUSES`, `JOB_STAGES`, `CHUNK_STATUSES`, `SPEAKER_ROLES`, `ALLOWED_AUDIO_CONTENT_TYPES`), size/duration constants, TypeScript read-model interfaces |
| `src/features/ai-intelligence/logic.ts` | Pure, framework-free business rules: `sessionChunkStoragePath`, `planSessionChunks`, `jobStageProgressPercent`, `isTerminalJobStage`, `formatDuration`, `countWords`, `todayIsoDate`, `closeTrailingPauseEvent`, `sumPausedSeconds`, `computeSessionDurationSeconds`, label/tone maps |
| `src/features/ai-intelligence/repository.ts` | All Firestore reads/writes for this module (Admin SDK) |
| `src/features/ai-intelligence/queries.ts` | Read-only façade consumed by pages: `listSessions`, `getSessionDetail`, `listProcessingJobs`, `getDashboardStats`, `getRecentAnalytics`, `getAiSettings` |
| `src/features/ai-intelligence/actions/create-session.ts` | `createSession` server action |
| `src/features/ai-intelligence/actions/delete-session.ts` | `deleteSession` server action |
| `src/features/ai-intelligence/actions/record-audio.ts` | `requestChunkUploadTicket`, `confirmChunkUpload`, `finalizeSessionRecording`, `pauseSessionRecording`, `resumeSessionRecording` server actions |
| `src/features/ai-intelligence/actions/retry-processing-job.ts` | `retryProcessingJob` server action |
| `src/features/ai-intelligence/actions/update-settings.ts` | `updateAiSettings` server action |
| `src/features/ai-intelligence/audio/types.ts` | `AudioSource` interface, `AudioDeviceInfo`/`AudioLevelSample`/`AudioQualityWarning`/`DeviceHealthCheck` types |
| `src/features/ai-intelligence/audio/device-classification.ts` | Pure: `classifyRecordingSource`, `evaluateAudioQuality`, `evaluateDeviceHealth`, `isRecordingSourceKind`, `RECORDING_SOURCE_LABELS` |
| `src/features/ai-intelligence/audio/device-classification.test.ts` | Unit tests for the above |
| `src/features/ai-intelligence/audio/media-device-audio-source.ts` | `MediaDeviceAudioSource` (the only `AudioSource` implementation — `getUserMedia` + `AnalyserNode`), `listAudioInputDevices` |
| `src/features/ai-intelligence/components/*.tsx` | 10 UI components (listed in §4) |
| `src/features/ai-intelligence/index.ts` | Public barrel — only exports from here should be imported outside the feature folder |
| `src/features/ai-intelligence/logic.test.ts` | Unit tests for `logic.ts` |
| `src/app/(app)/ai/*/page.tsx` | 7 Next.js Server Component pages (thin — permission check, data fetch, render) |
| `functions/src/ai/process-session-job.ts` | The `processAiSessionJob` Cloud Function |
| `functions/src/ai/chunk-pipeline.ts` | `mergeChunkTranscripts`, `selectChunksToProcess` — pure, unit-tested independently of Firestore |
| `functions/src/ai/chunk-pipeline.test.ts` | Unit tests for the merge/selection logic |
| `functions/src/ai/retry-with-backoff.ts` | `withRetry(fn, attempts, baseDelayMs)` generic helper |
| `functions/src/ai/providers/types.ts` | `SpeechProvider` / `SummaryProvider` interfaces, shared result types |
| `functions/src/ai/providers/factory.ts` | `getSpeechProvider()` / `getSummaryProvider()` — env-driven provider selection |
| `functions/src/ai/providers/mock-provider.ts` | Zero-credential fallback implementations |
| `functions/src/ai/providers/openai-provider.ts` | OpenAI implementation (raw `fetch`) |
| `functions/src/ai/providers/json.ts` | `extractJson`, `toSpeakerRole` — shared model-output parsing helpers |

---

## 2. Constants (schema.ts / logic.ts) — do not change without re-deriving dependents

**Warning:** These constants are cross-checked server-side. `finalizeSessionRecording` independently recomputes the expected chunk count from `totalDurationSeconds` via `planSessionChunks` and rejects the request if it disagrees with the client-reported `totalChunks` — so changing `CHUNK_DURATION_SECONDS` or `MAX_SESSION_DURATION_SECONDS` on only one side of the client/server boundary will cause every finalize call to fail validation.

| Constant | Value | Used for |
|---|---|---|
| `CHUNK_DURATION_SECONDS` | `600` (10 min) | Rollover interval; chunk planning |
| `MAX_SESSION_DURATION_SECONDS` | `5400` (90 min) | Recorder auto-stop; validation ceiling |
| `MAX_CHUNKS_PER_SESSION` | `9` (`Math.ceil(5400/600)`) | Ticket `chunkIndex` upper bound; last-chunk rollover suppression |
| `MAX_CHUNK_BYTES` | `14 * 1024 * 1024` (14 MB) | Ticket `sizeBytes` validation — chosen to clear Whisper's 25MB per-file cap with real margin |
| `ALLOWED_AUDIO_CONTENT_TYPES` | `audio/webm, audio/wav, audio/wave, audio/x-wav, audio/mpeg, audio/mp4, audio/ogg` | Ticket `contentType` enum validation |
| `SESSION_STATUSES` | `draft, recording, paused, processing, completed, failed` | `AiSessionStatus` union |
| `JOB_STAGES` | `queued, transcribing, merging, analyzing, saving, completed, failed` | `AiJobStage` union — see **T1** for a duplicate-declaration note |
| `CHUNK_STATUSES` | `uploading, uploaded, transcribing, transcribed, failed` | `ChunkStatus` union — `transcribing`/`transcribed` are only ever written by the Cloud Function (**L12**) |
| `SPEAKER_ROLES` | `trainer, student, unknown` | `SpeakerRole` union |
| `MEDIA_RECORDER_TIMESLICE_MS` (session-recorder.tsx) | `1000` | `MediaRecorder.start(timeslice)` argument |
| `CHUNK_UPLOAD_MAX_ATTEMPTS` (session-recorder.tsx) | `3` | Client upload retry ceiling |
| `CHUNK_UPLOAD_RETRY_DELAY_MS` (session-recorder.tsx) | `1000` | Linear backoff base (`delay * attempt`) |
| `UPLOAD_URL_TTL_MS` (record-audio.ts) | `30 * 60 * 1000` (30 min) | Signed PUT URL expiry |
| `STAGE_PROGRESS` (process-session-job.ts) | `{queued:0, transcribing:15, merging:60, analyzing:70, saving:90, completed:100, failed:0}` | UI progress-bar percentage |
| `withRetry` defaults (retry-with-backoff.ts) | `attempts=3, baseDelayMs=500` | Both `transcribe()` and `summarize()` calls inside the Cloud Function — see **P4** |

If you change `CHUNK_DURATION_SECONDS` or `MAX_SESSION_DURATION_SECONDS`, you must update both `planSessionChunks` (client/server validation) and re-derive `MAX_CHUNKS_PER_SESSION` — `finalizeSessionRecording` rejects any mismatch between the client-reported `totalChunks` and what `planSessionChunks(totalDurationSeconds)` independently computes.

---

## 3. Data model — exact field reference

### `aiSessions/{sessionId}`

```ts
schemaVersion: 1
branchId: string
title: string
status: 'draft' | 'recording' | 'paused' | 'processing' | 'completed' | 'failed'
trainerUid: string
batchId: string | null
programmeId: string | null
deviceLabel: string | null          // always null in the current UI — see L4
totalChunks: number | null
durationSeconds: number | null      // active recording time only — what the chunk pipeline transcribes
sessionDurationSeconds: number | null  // durationSeconds + pausedDurationSeconds; set by finalizeSessionRecording
pausedDurationSeconds: number        // sum of pauseHistory[].durationSeconds; recomputed on every pause/resume/finalize, never incremented
pauseCount: number                   // pauseHistory.length
pauseHistory: Array<{               // written with `new Date()`, not serverTimestamp() — Firestore rejects
  pausedAt: Timestamp                // serverTimestamp() inside array elements
  resumedAt: Timestamp | null        // null while the pause is still open
  durationSeconds: number | null     // null while the pause is still open
}>
processingJobId: string | null
transcriptId: string | null
summaryId: string | null
startedAt: Timestamp | null
endedAt: Timestamp | null
createdAt: Date
createdBy: string
updatedAt: Date
updatedBy: string
deletedAt: Date | null              // soft delete marker only — status is untouched by delete
```

**Pause/Resume field notes:**
- `pausedDurationSeconds`/`pauseCount` are always *derived* from `pauseHistory` (`sumPausedSeconds`/`.length` in `logic.ts`) at the point of every write — never independently incremented — so the counters and the array they summarize can never drift apart.
- A trailing `pauseHistory` entry with `resumedAt: null` means the session is currently paused (or was stopped while paused, before `finalizeSessionRecording` closes it — see `closeTrailingPauseEvent`).
- `requestChunkUploadTicket`/`confirmChunkUpload` are entirely unaware of pause state beyond the ordinary `status === 'recording'` precondition they already had — pausing never creates a chunk, so there is nothing chunk-related for them to special-case.

### `aiSessions/{sessionId}/chunks/{chunkIndex}` (doc id = chunk index as a string)

```ts
schemaVersion: 1
sessionId: string
chunkIndex: number
status: 'uploading' | 'uploaded' | 'transcribing' | 'transcribed' | 'failed'
storagePath: string        // aiSessions/{sessionId}/chunks/{chunkIndex}.{ext}
contentType: string
sizeBytes: number
startOffsetSec: number
durationSeconds: number | null
attempts: number
error: string | null
language: string           // written by the Cloud Function only
segments: TranscriptSegment[]  // written by the Cloud Function only
createdAt: Date
updatedAt: Date
updatedBy: string
```

### `aiProcessingJobs/{jobId}`

```ts
schemaVersion: 1
sessionId: string
sessionTitle: string
stage: 'queued' | 'transcribing' | 'merging' | 'analyzing' | 'saving' | 'completed' | 'failed'
progressPercent: number
chunksCompleted: number
chunksTotal: number
attempts: number
error: string | null
speechProvider: string | null
summaryProvider: string | null
createdAt: Date
updatedAt: Date
```

### `aiTranscripts/{sessionId}` (doc id = session id, written once by the pipeline)

```ts
schemaVersion: 1
sessionId: string
language: string
fullText: string
segments: TranscriptSegment[]   // { speaker, speakerLabel, text, startSec, endSec }
createdAt: Timestamp
```

### `aiSummaries/{sessionId}` (doc id = session id, written once by the pipeline)

```ts
schemaVersion: 1
sessionId: string
executiveSummary: string
keyLearningPoints: string[]
importantQuestions: string[]
actionItems: string[]
createdAt: Timestamp
```

### `aiAnalytics/{YYYY-MM-DD}` (merged/incremented by the pipeline)

```ts
date: string
sessionsCompleted: number
sessionsFailed: number
recordingSeconds: number
wordsTranscribed: number
```

### `aiIntelligenceSettings/config` (single document)

```ts
schemaVersion: 1
autoClassifySpeakers: boolean
notifyTrainerOnCompletion: boolean       // stored, not yet acted on — see L8
audioRetentionDays: number               // stored, not yet enforced — see L7
defaultRecordingSource: 'laptop_microphone' | 'usb_audio_interface' | 'wireless_receiver' | 'professional_audio_mixer'
                                          // Classroom Hardware Mode — pre-selection hint only, see 01 §8.2
activeSpeechProvider: string             // stamped by the Cloud Function, not by updateAiSettings
activeSummaryProvider: string            // stamped by the Cloud Function, not by updateAiSettings
updatedAt: Date
updatedBy: string
```

`findAiSettings()` returns a hardcoded default (`autoClassifySpeakers: true, notifyTrainerOnCompletion: true, audioRetentionDays: 365, defaultRecordingSource: 'laptop_microphone', activeSpeechProvider: 'mock', activeSummaryProvider: 'mock'`) if this document doesn't exist yet, or if a stored `defaultRecordingSource` value doesn't match one of the four known kinds (`isRecordingSourceKind` guard in `repository.ts`).

### Cross-collection lookups (read-only from this module)

`users/{trainerUid}.displayName`, `batches/{batchId}.code`, `programmes/{programmeId}.name` — resolved in `repository.ts`'s `toSession()` mapper to populate `trainerName`/`batchName`/`programmeName` on the read model, falling back to the raw id if the lookup fails.

---

## 4. Component reference

| Component | Type | Renders | Key props |
|---|---|---|---|
| `DashboardView` | Server | Stat tiles + recent sessions list; mounts `AutoRefresh(8000)` | `stats: AiDashboardStats`, `recentSessions: AiSession[]` |
| `SessionsTable` | Client | Session list table with delete action | `sessions: AiSession[]`, `canDelete: boolean` |
| `CreateSessionDialog` | Client | Create-session form (title/batch/programme) | `batches`, `programmes` |
| `SessionRecorder` | Client | Mic select + device check (level/peak/health) + record/pause/resume controls; `null` unless `session.status === 'draft'` | `session: AiSession`, `defaultRecordingSource?: RecordingSourceKind` |
| `SessionTimeline` | Server | Recording Started → Paused/Resumed pairs → Recording Stopped, built from `startedAt`/`pauseHistory`/`endedAt`; renders nothing until `startedAt` is set | `session: AiSession` |
| `ProcessingQueueView` | Client | Job table + retry action; mounts `AutoRefresh(4000)` while a job is active | `jobs: AiProcessingJob[]`, `canRetry: boolean` |
| `SummaryView` | Server | Executive summary + 3 list cards | `summary: AiSummary \| null` |
| `TranscriptView` | Client | Search box + segment list | `transcript: AiTranscript \| null` |
| `AnalyticsView` | Server | 4 totals + 2 inline-SVG bar charts (no charting library) | `days: AiAnalyticsDay[]` |
| `SettingsForm` | Client | 2 checkboxes + 1 number field + 2 read-only provider badges | `settings: AiIntelligenceSettings` |
| `AutoRefresh` | Client | Renders nothing; calls `router.refresh()` on an interval | `intervalMs?: number` (default 5000) |

`AutoRefresh` exists because this module has no client-side authenticated Firestore reads — see **L10**. If real-time listeners are built later, this component (and every place it's mounted, per **T3**) is the thing to remove/consolidate.

---

## 5. Security implementation reference

### 5.1 Server action guard pattern (identical across all 5 action files)

```ts
'use server';
const session = await getSession();
if (!session) return permissionError('Sign in required.');
if (!can(session.role, 'aiIntelligence:<permission>')) return permissionError();
const parsed = <schema>.safeParse(input);
if (!parsed.success) return validationError({ ...fieldErrors });
try {
  // business logic + repository call + writeAudit()
  return ok(result);
} catch {
  return internalError(...);
}
```

Every action returns the shared `Result<T>` discriminated union (`ok`/`err`) from `src/lib/utils/result.ts`. When adding a new action, follow this exact shape — the UI's error-handling (`toast.error`, `form.setError` for `error.code === 'validation'`) assumes it.

### 5.2 Ownership checks — copy this pattern for any new mutation on an existing session

```ts
const meta = await findSessionMeta(sessionId);
if (!meta) return notFoundError('Session not found.');
if (meta.trainerUid !== session.uid) {
  return permissionError('Only the session owner can <verb>.');
}
```

Used in `requestChunkUploadTicket`, `confirmChunkUpload`, `finalizeSessionRecording`, `pauseSessionRecording`, `resumeSessionRecording`. `retryProcessingJob` uses the owner-OR-elevated-permission variant:

```ts
const isOwner = owningSession?.trainerUid === session.uid;
if (!isOwner && !can(session.role, 'aiIntelligence:configure')) {
  return permissionError('Only the session owner can retry this job.');
}
```

`deleteSession` intentionally has **no** ownership check today (**L3**) — it relies solely on `aiIntelligence:delete` being System Administrator/Founder-only. If `delete` is ever granted to Trainer, add an ownership check at the same time (**E3**).

### 5.3 Firestore rules pattern for a new AI collection

```
match /aiNewCollection/{docId} {
  allow read: if can_aiIntelligence_view();
  allow write: if false; // Admin SDK only
}
```

All 6 existing AI collections follow this exact shape — role-gated read, unconditional write deny. `can_aiIntelligence_*()` predicates are generated from `ROLE_PERMISSIONS` in `src/lib/rbac/permissions.ts`; run the project's rules-codegen/drift-check after changing the permission map, rather than hand-editing the generated predicate functions. Note this pattern is role-gated only, not branch- or ownership-scoped — see **L1**/**L2** before assuming a new collection inherits data isolation it doesn't actually have.

### 5.4 Storage — do not add path-based Storage rules for this module

`storage.rules` is a single blanket deny for the entire bucket by design (Doc 10 §4 pattern). New Storage paths for this module should continue to use the signed-URL pattern (`adminBucket().file(path).getSignedUrl({version:'v4', action:'write', expires, contentType})`) rather than adding a rule block.

### 5.5 Audit logging

```ts
await writeAudit({
  actorUid: session.uid,
  actorRole: session.role,
  action: 'create' | 'update' | 'soft_delete',
  entityType: 'ai_session' | 'ai_processing_job' | 'ai_intelligence_settings',
  entityId,
  entityPath: `<collection>/${entityId}`,
  changes: { field: { before, after } },   // optional
  context: { feature: 'ai-intelligence', reason?: string },
});
```

Chunk upload ticket/confirm calls deliberately skip this — treat any new high-frequency, non-business-decision write the same way. Note **T6**: `writeAudit` hardcodes `branchId: DEFAULT_BRANCH_ID`, so audit entries for this module are not branch-attributable today.

---

## 6. Provider abstraction — extending with a new AI provider

To add a third provider (e.g. `azure`):

1. Implement `SpeechProvider` and/or `SummaryProvider` from `functions/src/ai/providers/types.ts`:
   ```ts
   interface SpeechProvider {
     readonly name: string;
     transcribe(input: { audioBuffer: Buffer; contentType: string; sessionTitle: string }): Promise<TranscriptionResult>;
   }
   interface SummaryProvider {
     readonly name: string;
     summarize(input: { transcriptText: string; sessionTitle: string }): Promise<SummaryResult>;
   }
   ```
2. Add the new branch to `getSpeechProvider()`/`getSummaryProvider()` in `factory.ts`, following the existing pattern: check the `AI_SPEECH_PROVIDER`/`AI_SUMMARY_PROVIDER` string value, check the matching secret is present, else fall through toward mock. Note **P1**: a missing secret today fails silently to mock with no distinguishable log — consider adding an explicit warning log when introducing a new provider branch.
3. Declare any new `defineSecret`/`defineString` params in `factory.ts` and add them to the `secrets: [...]` array on the `processAiSessionJob` function definition in `process-session-job.ts` — Cloud Functions secrets must be explicitly declared per-function or they won't be injected at runtime.
4. Use `extractJson`/`toSpeakerRole` from `json.ts` for parsing model output — both existing providers rely on these for defensive coercion of untrusted model JSON (see **T2** for the lack of stronger schema validation here).
5. No changes are needed in `process-session-job.ts`, `chunk-pipeline.ts`, or anywhere in `src/features/ai-intelligence` — the entire pipeline and frontend are provider-agnostic by construction; they only ever call the `SpeechProvider`/`SummaryProvider` interface methods.

---

## 7. Testing

- `src/features/ai-intelligence/logic.test.ts` — unit tests for pure functions in `logic.ts` (chunk planning, progress percent, terminal stage detection, duration formatting, and the pause/resume math: `closeTrailingPauseEvent`, `sumPausedSeconds`, `computeSessionDurationSeconds`).
- `functions/src/ai/chunk-pipeline.test.ts` — unit tests for `mergeChunkTranscripts` (offset-shifting, out-of-order chunk defensiveness, language fallback) and `selectChunksToProcess` (resume filtering).
- `src/features/ai-intelligence/audio/device-classification.test.ts` — unit tests for `classifyRecordingSource` (label-keyword heuristics), `evaluateAudioQuality` (clipping/silent/low thresholds), and `evaluateDeviceHealth` (the four-item readiness checklist).
- There is no integration test coverage against a live Firestore emulator or the real OpenAI API (**T4**) — provider correctness is verified by the mock provider's deterministic output plus manual verification against a real OpenAI account.
- When changing `planSessionChunks`, `mergeChunkTranscripts`, or any `STAGE_PROGRESS`/status-string constant, run/extend both test files — they are the only automated guard against silently breaking the chunk-boundary or resume logic.

---

## 8. Common extension scenarios

| If you need to... | Start here | Related note |
|---|---|---|
| Add a field to the create-session form | `createSessionSchema` (schema.ts) → `CreateSessionDialog` form fields → `createSessionRecord` (repository.ts) write | — |
| Add a new session status | `SESSION_STATUSES` (schema.ts) → `SESSION_STATUS_LABELS`/`SESSION_STATUS_KIND` (logic.ts) → every place that switches on `status` | — |
| Change how a pause affects the rollover/max-duration timers | `armRolloverForCurrentChunk`/`armMaxDurationStop` and the deadline/remaining-ms refs in `session-recorder.tsx`'s `handlePauseClick`/`handleResumeClick` | Keep both timers measuring *active* time, not wall-clock, or a long break will shorten later chunks / cap the session early |
| Add a field to `pauseHistory` (e.g. a pause reason) | `PauseEvent` (schema.ts) → `PauseEventInput` (logic.ts) → `toPauseEventInput`/`toPauseEventReadModel` (repository.ts) → `markSessionPaused` write → `SessionTimeline` render | Keep `pausedDurationSeconds`/`pauseCount` derived from the array, not separately maintained |
| Add a new job stage | `JOB_STAGES` (schema.ts) → `JOB_STAGE_ORDER`/`STAGE_PROGRESS`/`JOB_STAGE_LABELS`/`JOB_STAGE_KIND` (logic.ts + process-session-job.ts) → `isTerminalJobStage` if terminal | Update both declarations per **T1** |
| Implement branch scoping | Add a `branchId` predicate to `can_aiIntelligence_*` rule blocks; add `where('branchId', '==', ...)` to every `repository.ts` query | **L1** / **E1** |
| Implement per-trainer read scoping | `listSessions({ trainerUid })` already accepts the parameter — wire it through from the calling page | **L2** / **E2** |
| Add real-time updates instead of polling | Requires client-side authenticated Firestore reads (custom-token minting); replace `AutoRefresh` with `onSnapshot` once that seam exists | **L10** / **E10** |
| Add audio retention enforcement | Build a new scheduled Cloud Function reading `audioRetentionDays` and deleting expired Storage objects + Firestore docs | **L7** / **E7** |
| Add completion notifications | Hook into `process-session-job.ts`'s success path (after `stage='completed'`), reading `notifyTrainerOnCompletion` | **L8** / **E8** |
| Fix the dead `deviceLabel` field | Either add the missing input to `CreateSessionDialog`, or remove the field end-to-end | **L4** / **E4** |
| Add a new device-kind keyword (e.g. a new mixer brand) | `classifyRecordingSource` in `audio/device-classification.ts` — add to the relevant keyword/vendor array, add a test case | Display-only labeling; never gates device selection |
| Adjust audio quality thresholds (clipping/silent/low) | `CLIPPING_PEAK_THRESHOLD`/`SILENT_PEAK_THRESHOLD`/`LOW_LEVEL_THRESHOLD` in `audio/device-classification.ts` — same constants back both the pre-recording check and the recording-time meter in `session-recorder.tsx` | Update `device-classification.test.ts` alongside |
| Support a real multi-channel mixer/console | Implement `AudioSource` (`audio/types.ts`) directly — do not extend `MediaDeviceAudioSource` for hardware that needs more than one `audioinput` stream exposes | **L17** / **E13** |
| Add a new `RecordingSourceKind` option (Settings § Classroom Hardware Mode) | `RECORDING_SOURCES` (schema.ts) → `RECORDING_SOURCE_LABELS` (audio/device-classification.ts) → `classifyRecordingSource`'s keyword/vendor tables | Also update `SettingsForm`'s dropdown (auto-populates from `RECORDING_SOURCES`, no separate change needed there) |
