# Engineering 04 — Known Limitations & Engineering Notes

**Document version:** 1.3
**Last reviewed:** 2026-08-05
**Audience:** Engineering team, technical leads
**Companion documents:** [01 — Technical Architecture](01-technical-architecture.md) · [02 — Developer Guide](02-developer-guide.md) · [03 — API & AI Workflow Guide](03-api-workflow-guide.md)

This document consolidates every implementation observation made while documenting the AI Intelligence Platform as it actually exists in the codebase today. None of these are defects in the sense of "broken" — the module works end to end as designed — but each is a deliberate scope boundary, an accepted trade-off, or a gap worth tracking for future work. Nothing here has been acted on; this is documentation only.

Client-facing documentation ([User Guide](../client/01-user-guide.md), [Administrator Guide](../client/02-administrator-guide.md)) intentionally omits everything below except where an item directly changes how a user operates the product (e.g. "no resume after a crash" is called out there as an operating fact; the *reason* it's absent is documented here).

**Note:** Treat every item below as a scope boundary to design around, not a punch list to silently patch. Several limitations (particularly **L1** branch scoping and **L2** read scoping) are load-bearing assumptions elsewhere in the module — closing one without checking its cross-references (**T6**, **E1**, **E2**) can introduce new inconsistencies rather than resolving the gap.

---

## 1. Current Implementation Limitations

| # | Limitation | Where |
|---|---|---|
| L1 | **No branch-scoped access control.** Every session document stores a `branchId`, but no query (`findSessions`, `findDashboardStats`, `findRecentAnalytics`) filters by it, and no Firestore rule predicate checks it. Any role holding `aiIntelligence:view` sees every session across the entire organization, not just their own branch. Currently masked because the deployment has a single branch (`HQ`). | `repository.ts`, `firestore.rules` |
| L2 | **No per-user read scoping.** `listSessions(options?: { trainerUid?: string })` accepts an owner filter, but every calling page invokes it with no argument — any viewer can also open any session's detail page (including its transcript and summary) by ID, not only sessions they created. | `queries.ts`, `src/app/(app)/ai/*` |
| L3 | **No ownership check on session deletion.** `deleteSession` is gated only by the `aiIntelligence:delete` role permission, with no `trainerUid` comparison. This is safe today only because `delete` is granted exclusively to System Administrator/Founder — if it is ever extended to Trainer, cross-trainer deletion becomes possible without further code changes. | `actions/delete-session.ts` |
| L4 | **`deviceLabel` is a dead field.** It exists in the Zod schema, the create-session form's default values, the server action input, the repository write, and the session document — but `CreateSessionDialog` has no rendered input for it. It is always persisted as `null`. | `schema.ts`, `create-session-dialog.tsx` |
| L5 | **`aiIntelligence:assign` / `aiIntelligence:approve` are unused.** Both permission keys are generated as Firestore predicate functions and included in the module's permission enum, but no role is granted either for a real workflow, and no server action or UI element checks them. | `permissions.ts`, `firestore.rules` |
| L6 | **`aiIntelligence:export` has no corresponding feature.** Operations Manager holds this permission, but no export action, button, or endpoint exists anywhere in the module. | `permissions.ts` |
| L7 | **`audioRetentionDays` is stored but not enforced.** The Settings page captures a 7–3650 day value; nothing reads it, and no scheduled job purges audio or Firestore records at any age. Audio is retained indefinitely regardless of the configured value. | `update-settings.ts`, `settings-form.tsx` |
| L8 | **`notifyTrainerOnCompletion` is stored but not implemented.** No notification-sending code exists anywhere in the module; toggling this setting has no observable effect. | same as above |
| L9 | **No resume-after-crash capability, including while paused.** The recorder keeps all in-progress state (elapsed time, chunk index, buffered audio, pause timers) in memory only — no `localStorage`/`IndexedDB` persistence. A closed tab or crash strands the session in `recording` **or `paused`** status; any chunk that had already uploaded and confirmed remains safely stored, and the server-side `pauseHistory` up to that point is accurate, but there is no UI path to resume, pause, or finalize that session from a different tab or after a reload — `SessionRecorder` renders nothing once `session.status !== 'draft'` (see Engineering 02 §4), by design, the same as it always has for `recording`. The session detail page shows an explanatory banner for both `recording` and `paused` so this isn't a silent dead end; a System Administrator can soft-delete a stuck session without losing what was already captured. | `session-recorder.tsx`, `src/app/(app)/ai/session/[id]/page.tsx` |
| L10 | **No real-time Firestore listeners.** The module has no authenticated client-side Firestore reads (custom-token minting for the client SDK is a tracked, unbuilt seam). All "live" UI updates are `router.refresh()` on a fixed interval via the shared `AutoRefresh` component (8s Dashboard, 4s Processing Queue while a job is active, 4s session-detail while Processing) rather than `onSnapshot`. | `auto-refresh.tsx` |
| L11 | **Transcript search is text-only.** The Transcript tab implements a case-insensitive substring filter over segment text and nothing else — no speaker filter and no timestamp-jump/inline audio playback, even though the Transcript Center's own descriptive copy says "search, filter by speaker, and jump to a timestamp." | `transcript-view.tsx`, `transcripts/page.tsx` |
| L12 | **Chunk statuses `transcribing`/`transcribed` are backend-only.** These are declared in `CHUNK_STATUSES` but only ever written by `processAiSessionJob`; the frontend upload flow only ever sets `uploading`/`uploaded`/`failed`. | `schema.ts`, `process-session-job.ts` |
| L13 | **No bulk retry.** Every failed job on the Processing Queue must be retried individually — there is no "retry all failed jobs" action. | `processing-queue-view.tsx` |
| L14 | **No automatic retry.** A failed job stays `failed` indefinitely until a human clicks Retry; there is no scheduled sweep that re-queues failed jobs automatically. | `process-session-job.ts` |
| L15 | **`AudioSource` is only wired into the pre-recording device check, not the recording-time stream.** `SessionRecorder`'s actual `MediaRecorder`/chunking/pause-resume code still calls `getUserMedia`/builds its own `AnalyserNode` directly, unchanged from before the `AudioSource` abstraction existed — only `startMonitoring`/`stopMonitoring` (the "Check microphone" flow) go through `MediaDeviceAudioSource`. Deliberate, per the classroom hardware request's "do not change the recording engine" constraint, but it means the level/peak/quality logic is duplicated (once in `MediaDeviceAudioSource`, once inline in `session-recorder.tsx`'s `startMeterLoop`) rather than shared. | `session-recorder.tsx`, `audio/media-device-audio-source.ts` |
| L16 | **Per-device sample rate/channel count aren't known until a device is opened.** `navigator.mediaDevices.enumerateDevices()` never exposes capabilities, by Web-platform design (it would fingerprint hardware without a permission prompt) — only `MediaStreamTrack.getSettings()`/`getCapabilities()` after `getUserMedia` succeeds on that specific device does. The device list's Sample rate/Channel count columns are genuinely unknown, not merely unfetched, for every device until the trainer selects and opens it via **Device check** or **Start recording**. | `audio/types.ts`, `audio/media-device-audio-source.ts` |
| L17 | **`AudioSource` has exactly one real implementation.** `MediaDeviceAudioSource` (standard browser `getUserMedia`) is the only concrete `AudioSource` today — an 8-channel USB mixer, digital console, or conferencing-system integration (anything needing more than what a single `audioinput` `MediaStream` exposes) would require a new implementation of the interface, not yet built. | `audio/types.ts` |

---

## 2. Future Enhancement Opportunities

| # | Opportunity | Addresses |
|---|---|---|
| E1 | Add branch-filtering to every AI query and the corresponding Firestore rule predicates to restore real multi-branch data isolation. | L1 |
| E2 | Wire `listSessions({ trainerUid })` into a "My sessions" toggle/default view for the Trainer role. | L2 |
| E3 | Add an explicit ownership check to `deleteSession` before extending `aiIntelligence:delete` to any additional role. | L3 |
| E4 | Either add the missing `deviceLabel` input to `CreateSessionDialog`, or remove the field end-to-end. | L4 |
| E5 | Wire `aiIntelligence:assign`/`:approve` into a real workflow (e.g. assigning sessions for coordinator review, approving flagged content) or drop them from the module's permission enum. | L5 |
| E6 | Build the export feature `aiIntelligence:export` already anticipates (e.g. CSV/PDF export of a transcript or analytics range), or remove the unused grant. | L6 |
| E7 | Build a scheduled "retention sweep" Cloud Function that reads `audioRetentionDays` per settings and purges expired Storage objects and/or Firestore documents. | L7 |
| E8 | Implement `notifyTrainerOnCompletion` using the CRM's existing communications/notification infrastructure. | L8 |
| E9 | Add client-side persistence (e.g. IndexedDB) of in-progress recording state, plus a "resume this session" affordance for sessions stuck in `recording` or `paused`. | L9 |
| E10 | Build the custom-token-minting seam for authenticated client Firestore reads, then migrate `AutoRefresh` polling to `onSnapshot` real-time listeners. | L10 |
| E11 | Add a speaker filter and inline audio playback with timestamp-jump to the Transcript view, matching its existing descriptive copy. | L11 |
| E12 | Add a "retry all failed jobs" bulk action to the Processing Queue, and/or a scheduled sweep that automatically re-queues jobs that have been failed for longer than a configurable threshold. | L13, L14 |
| E13 | Migrate `SessionRecorder`'s recording-time `getUserMedia`/`AnalyserNode` code to also go through `MediaDeviceAudioSource`, so the level/peak/quality logic is exercised through one code path instead of two; and, when an actual multi-channel mixer/console integration is scoped, implement `AudioSource` for it directly rather than extending `MediaDeviceAudioSource`. | L15, L17 |

---

## 3. Technical Debt

| # | Detail |
|---|---|
| T1 | **Duplicate `JobStage` type declaration.** The `AiJobStage` union is defined once in `src/features/ai-intelligence/schema.ts` (`JOB_STAGES`) and re-declared independently in `functions/src/ai/process-session-job.ts`. A stage added to one without the other desyncs the Next.js app and the Cloud Function silently — there is no shared package between the two runtimes. |
| T2 | **No schema validation on AI provider JSON output.** `extractJson` (`providers/json.ts`) only strips a Markdown code fence and calls `JSON.parse` — there is no Zod (or equivalent) validation of the resulting shape. Each provider file hand-defaults missing fields inline rather than validating against one shared schema. |
| T3 | **Hardcoded polling intervals.** `AutoRefresh` is mounted independently on three pages with three separately hardcoded millisecond values (8000, 4000, 4000) rather than one named, shared constant. |
| T4 | **No integration test coverage.** Only pure-function unit tests exist (`logic.test.ts`, `chunk-pipeline.test.ts`). There is no test against a live Firestore emulator, no test exercising `processAiSessionJob` end to end, and no test against a real (or recorded/mocked) provider HTTP response. This also applies to Pause/Resume: `markSessionPaused`/`markSessionResumed`/the `finalizeSessionAndEnqueue` trailing-pause-close path are exercised only indirectly, through unit tests of the pure functions they call (`closeTrailingPauseEvent`, `sumPausedSeconds`) — there is no emulator-backed test proving the Firestore transactions themselves behave correctly under real concurrency, and no test of `session-recorder.tsx`'s `MediaRecorder.pause()/resume()` integration (no DOM/MediaRecorder mocking exists in this project's test setup). |
| T6 | **Audit branch attribution is not trustworthy.** `writeAudit` hardcodes `branchId: DEFAULT_BRANCH_ID` ("HQ") rather than reading the actor's real branch. This compounds L1 — even if branch-scoped queries are added elsewhere, the audit trail itself would still misattribute branch until this call site is fixed too. |

---

## 4. Provider-Specific Considerations

Gemini support was removed (1.2) — findings that only existed as an OpenAI-vs-Gemini comparison (former P3, P6) were deleted rather than repurposed; IDs are stable references, not resequenced, so this table intentionally skips from P2 to P4 and again from P5 to P7.

| # | Detail |
|---|---|
| P1 | **Silent fallback to mock on misconfiguration.** If `AI_SPEECH_PROVIDER`/`AI_SUMMARY_PROVIDER` is set to `openai` but `OPENAI_API_KEY` is missing or empty, `factory.ts` falls through to the mock provider with no error, warning, or distinguishable log entry at the point of selection. This is invisible until someone notices placeholder transcript/summary text on a completed session. |
| P2 | **Two calls per chunk.** OpenAI's speech path makes 2 upstream HTTP calls per chunk with speech present (Whisper transcription, then a separate chat-completion speaker-classification pass, since Whisper itself has no diarization). This affects both cost and per-chunk latency versus a hypothetical single-call design. |
| P4 | **Generic, non-adaptive retry.** `withRetry` (3 attempts, 500ms/1000ms linear backoff) does not read or honor OpenAI's `Retry-After` header semantics on rate-limit (429) responses. |
| P5 | **No circuit breaker.** A systemic OpenAI outage fails every in-flight job independently (each exhausting its own 3 retries) rather than short-circuiting further attempts after the first observed outage. |
| P7 | **No model-id validation.** `OPENAI_TRANSCRIBE_MODEL`/`OPENAI_SUMMARY_MODEL` default sensibly, but a mistyped or deprecated override is not caught at configuration time — it only surfaces as a normal API error inside a job's `error` field at run time, indistinguishable by message alone from a genuine outage. |

---

## 5. Performance Considerations

| # | Detail |
|---|---|
| R1 | **Chunks are processed strictly sequentially.** `processAiSessionJob` transcribes one chunk at a time in a `for...of` loop — never concurrently. A 9-chunk (90-minute) session's total transcription time is the sum of 9 sequential provider calls, not the maximum of them run in parallel. |
| R2 | **Single 540-second (9-minute) execution budget** covers however many chunks are pending plus the merge and summarize steps in one Cloud Function invocation. A session with several slow-to-transcribe chunks risks the function's own timeout firing before summarization runs — which surfaces as a raw platform timeout, not the module's own `failed` stage with a readable error message. |
| R3 | **1GiB memory allocation** is sized around holding exactly one chunk's audio buffer in memory at a time, a direct consequence of R1's sequential design. Increasing chunk size or introducing concurrency would require re-evaluating this allocation. |
| R4 | **`maxInstances: 10`** is a global Cloud Functions setting (not AI-specific) that caps how many sessions can be processed in parallel across the entire Functions deployment. A burst of many trainers finishing sessions at once queues beyond that ceiling rather than parallelizing further. |
| R5 | **No client-side upload concurrency limit.** Each finished chunk's upload (ticket → PUT → confirm, with its own up-to-3 retry cycle) fires independently as soon as it's ready; on a slow connection, several chunk uploads and their retries can overlap with no client-side throttling. |
| R6 | **Analytics are pre-aggregated by design, not queryable ad hoc.** `aiAnalytics/{date}` daily rollups are incrementally maintained specifically to avoid scanning all sessions on every dashboard load. Any future analytics need beyond the existing 4 counters (sessions completed/failed, recording seconds, words transcribed) requires a new read path, not an extension of the current counters. |

---

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-02 | Initial consolidation of all implementation observations found during the documentation review, moved out of the client-facing guides and out of narrative asides in the architecture/developer/API documents. |
| 1.1 | 2026-08-03 | Pause/Resume Recording shipped. L9 extended to cover the new `paused` status (same crash/reload limitation as `recording`, now with an explanatory banner instead of silence). T4 extended to note the same "pure-function-only" test coverage caveat applies to the new pause bookkeeping. |
| 1.2 | 2026-08-05 | Gemini support removed — OpenAI is now the only real provider. Deleted P3 (Gemini inline-audio constraint) and P6 (Gemini-vs-OpenAI classification-quality comparison), both no longer applicable with a single provider. Deleted T5 ("whisper-1 is hardcoded") — no longer true; it's configurable via `OPENAI_TRANSCRIBE_MODEL`. P1, P2, P4, P7 reworded to drop Gemini comparisons while keeping the underlying OpenAI-specific observation. |
| 1.3 | 2026-08-05 | Classroom Hardware Mode shipped (`audio/` module, `AudioSource` abstraction, device classification/health/quality checks, Settings default). Added L15 (`AudioSource` only wired into the pre-recording check, not the recording-time stream), L16 (per-device sample rate/channel count unknowable before the device is opened — a Web platform constraint, not a gap to close), L17 (`AudioSource` has one real implementation), and E13 (the corresponding follow-up: unify the two metering code paths, and implement `AudioSource` for a real mixer/console when one is scoped). |
