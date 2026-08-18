/**
 * Provider abstraction (AI Session Intelligence Proposal). Business logic
 * (`process-session-job.ts`) depends only on these interfaces — never on a
 * concrete vendor — so the speech-to-text and summarization backends are
 * swappable via environment configuration (`factory.ts`) with zero changes
 * to the pipeline itself.
 */

export type SpeakerRole = 'trainer' | 'student' | 'unknown';

/** How `speaker`/`speakerLabel` were determined — see the identical
 * client-side type in `src/features/ai-intelligence/schema.ts` for the
 * full reasoning. `'channel'` (real, hardware-verified identity from a
 * mapped physical input channel) is never produced today: no capture path
 * yet writes a chunk's `channelIndex`, so `knownSpeaker` below is always
 * `undefined` in production until that capture work lands. */
export type AttributionSource = 'channel' | 'heuristic';

export interface TranscriptSegment {
  speaker: SpeakerRole;
  speakerLabel: string;
  text: string;
  startSec: number;
  endSec: number;
  attributionSource: AttributionSource;
  channelIndex: number | null;
}

export interface TranscriptionResult {
  fullText: string;
  language: string;
  segments: TranscriptSegment[];
}

export interface SpeechProvider {
  readonly name: string;
  transcribe(input: {
    audioBuffer: Buffer;
    contentType: string;
    sessionTitle: string;
    /**
     * Set only when this audio is known — from real hardware channel
     * identity, not a guess — to belong to one specific speaker (a chunk
     * whose `channelIndex` matches a configured `ChannelRoleMapping`).
     * When present, the provider must skip any text-based
     * classification entirely and stamp every returned segment with this
     * exact role/label and `attributionSource: 'channel'` — mixing a real
     * channel identity with a heuristic guess for the same audio would be
     * actively misleading, not just imprecise.
     */
    knownSpeaker?: { role: SpeakerRole; label: string; channelIndex: number } | null;
  }): Promise<TranscriptionResult>;
}

/**
 * Structured session summary (AI Session Intelligence Proposal §11). The
 * original four fields (`executiveSummary`…`actionItems`) are untouched —
 * every consumer written against them keeps working. The five added below
 * are additive only: an older `aiSummaries` doc written before this change
 * simply won't have them, and every reader must treat their absence as
 * "not extracted", not as an error (see `toSummary` in repository.ts and
 * `MockSummaryProvider` below, both of which supply empty defaults).
 * Grounding requirement (Doc: "never hallucinate"): every field here must
 * come from what the transcript actually contains — an empty string/array
 * is the correct, expected output when a session genuinely has nothing for
 * that category, never a fabricated name, statement, or conclusion.
 */
export interface SummaryResult {
  executiveSummary: string;
  keyLearningPoints: string[];
  importantQuestions: string[];
  actionItems: string[];
  /** Narrative account of what the trainer covered/explained — distinct from `keyLearningPoints`' bullet list. */
  trainerDiscussion: string;
  /** Narrative account of how students engaged — questions asked, answers given, visible engagement level. */
  studentParticipation: string;
  /** Notable moments that aren't quite a "key learning point" or a "question" — confusion, a strong insight, a tangent worth flagging. */
  importantObservations: string[];
  /** Concrete next steps implied by the session but not phrased as a direct action item (e.g. "revisit topic X next class"). */
  followUpRequired: string[];
  /** Per-participant observations when individual students are identifiable in the transcript — never fabricated names or attendance. */
  participantInsights: string[];
}

export interface SummaryProvider {
  readonly name: string;
  summarize(input: { transcriptText: string; sessionTitle: string }): Promise<SummaryResult>;
}
