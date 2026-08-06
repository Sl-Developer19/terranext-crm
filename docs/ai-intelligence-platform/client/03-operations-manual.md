# AI Intelligence Platform — Operations Manual

**Document version:** 1.2
**Last updated:** 2026-08-05
**Audience:** System Administrators and Operations staff responsible for day-to-day running of the platform
**Related documents:** [Administrator Guide](02-administrator-guide.md) (configuration) · [User Guide](01-user-guide.md) (end-user operation)

> This manual covers routine operation and incident response. For one-time setup and configuration, see the [Administrator Guide](02-administrator-guide.md). For deployment and technical configuration, see the [Installation & Deployment Guide](../engineering/05-installation-deployment-guide.md).

---

## 1. Purpose & Scope

This manual describes the routine tasks needed to keep the AI Intelligence Platform running smoothly once it has been configured, and the steps to follow when something goes wrong. It is written for the person who checks on the platform day to day — confirming sessions are processing normally, clearing failed jobs, and knowing who to escalate to when an issue is outside what can be fixed from the CRM interface.

---

## 2. Daily Operational Checklist

A brief daily check takes under five minutes:

1. Open **Dashboard**. Confirm **Pending processing** is not unexpectedly high (a large, growing number suggests a stuck queue — see §4).
2. Open **Processing Queue**. Confirm there are no jobs sitting in **Failed** for longer than expected.
3. Open **Settings**. Confirm the **Active speech provider** and **Active summary provider** badges show the expected provider (not the demonstration/mock mode) if real AI processing has been configured for your organization.

**Best Practice:** Do this check at the same time each day (for example, at the start of the working day) so a stuck queue is caught before a trainer or coordinator notices it first.

---

## 3. Monitoring the Platform

Three screens double as monitoring surfaces:

| Screen | What to watch |
|---|---|
| **Dashboard** | Today's sessions, pending processing count, completed count, total/active/paused recording hours, number of pauses — a sudden drop in completions or a rising "pending" count is the earliest visible sign of a problem |
| **Processing Queue** | Any job sitting at a non-terminal stage (Queued, Transcribing, Merging transcript, AI analysis, Saving) for an unusually long time, or any job in **Failed** |
| **Analytics** | The daily "sessions failed" total — a spike on a given day points to that day's provider or connectivity issue |

**Note on Pause/Resume:** "Paused hours" and "Number of pauses" on the Dashboard are informational only — a high pause count is normal for classroom sessions with frequent breaks and is not itself a fault to investigate.

**Note:** Longer recordings naturally take longer to process, since each segment of a session is transcribed in turn rather than all at once. A 90-minute session taking noticeably longer than a 15-minute one is expected behavior, not a fault.

---

## 4. Incident Response Procedures

```mermaid
flowchart TD
    A[Symptom observed] --> B[Check Dashboard / Processing Queue / Analytics]
    B --> C{Job shows Failed?}
    C -- no, still processing --> D[Wait — normal for longer recordings]
    C -- yes --> E[Click Retry (owner or admin)]
    E -- fails again --> F[Escalate — Section 6]
```

| Symptom | Likely cause | Response |
|---|---|---|
| Several sessions stuck on **Processing** at once | A provider outage, or a burst of sessions finishing at the same time creating a backlog | Wait a short period for the backlog to clear; if jobs start showing **Failed** with the same error message, treat as a provider outage — escalate to your technical team (§6) |
| A single job shows **Failed** | The AI transcription or analysis step hit an error for that session only | Click **Retry** (System Administrators and Founders can retry any job) — it resumes rather than restarting from scratch. If it fails again with the same error, escalate |
| Every new session completes with placeholder-looking transcript/summary text | AI processing has silently reverted to demonstration mode, most likely because a provider credential expired or was misconfigured | Escalate to your technical team immediately — this does not stop sessions from "completing," so it can go unnoticed without the daily check in §2 |
| A trainer reports a recording that never finished saving | The browser tab was closed or crashed before the last segment finished uploading | **Do not** ask the trainer to delete and re-record over the same session. Escalate to your technical team — the segments that did upload successfully are still safely stored and may be recoverable |
| A session shows **Paused** and hasn't changed for a long time | The trainer's browser tab was closed or refreshed while paused — Pause/Resume/Stop only work from the tab where recording was started, the same limitation that applies mid-recording | Anything already uploaded is safely stored. If the trainer is available, ask them to open a new session; otherwise remove (soft-delete) the stuck one per the [Administrator Guide §3](02-administrator-guide.md#3-managing-sessions) |
| A trainer cannot see the Retry button on their own failed job | Working as intended — only the session's owner or a System Administrator/Founder can retry a job | If the original trainer is unavailable, a System Administrator or Founder retries on their behalf |
| A user reports "not authorized" on any AI Intelligence Platform page | Their role does not include the required access | Confirm their role assignment; adjust if the access should be granted |
| A trainer reports classroom hardware (wireless receiver, USB interface, mixer) isn't showing up in the microphone list | The OS itself doesn't see the device — a browser can only list what the operating system already recognizes as an audio input | Have them check Windows/macOS Sound settings directly (outside the browser) first; if it's missing there too, it's a hardware/driver issue, not a platform issue |
| A completed session's transcript quality is poor despite a working microphone | Gain was likely set too low or too high on the receiver/interface/mixer itself — the platform has no control over that hardware's gain | Have the trainer use **Check microphone** on the recording screen before their next session — it flags low volume and clipping before recording starts, which is the earliest point this is catchable |

**Warning:** Never remove (soft-delete) a session as a way to "clear" a stuck or failed one — deletion hides it from the active list but does not restart, retry, or fix processing. Use the Retry action for failed jobs instead.

---

## 5. Routine Maintenance Tasks

- **Weekly:** review the Processing Queue for any long-failed jobs that were never retried, and either retry or investigate them.
- **Weekly:** spot-check the Analytics screen's "sessions failed" trend — a rising trend over several days (rather than an isolated spike) is worth escalating even if each individual failure was retried successfully.
- **As needed:** remove (soft-delete) sessions that are no longer relevant to the active list, per the [Administrator Guide §3](02-administrator-guide.md#3-managing-sessions). This does not delete the underlying recording, transcript, or summary.
- **Periodically:** confirm with your technical team what audio retention and completion-notification behavior is currently active for your deployment, since the values on the Settings screen record your organization's intended policy but their enforcement should be periodically reconfirmed with the technical team (see [Administrator Guide §4](02-administrator-guide.md#4-settings)).

---

## 6. Escalation Path

| Issue type | Escalate to |
|---|---|
| Access/role/permission questions | Your organization's System Administrator |
| A single job repeatedly failing with the same error | Your technical/engineering team, with the exact error message from the Processing Queue row |
| Provider badge shows demonstration mode unexpectedly | Your technical/engineering team — this is a configuration issue, not something fixable from the CRM |
| A session's recording did not finish saving | Your technical/engineering team — do not delete or re-record the session first |
| Broader platform outage (nothing loads, every session fails) | Your technical/engineering team, treated as a priority incident |

When escalating, always include: the session title and/or ID (visible in the page URL), the exact status/stage shown, and the exact error text if one is displayed.

---

## 7. Backup & Retention Notes

- Removing (soft-deleting) a session from the Sessions list does not delete its recording, transcript, or summary — it only hides it from the active list.
- The Settings screen's audio retention value records your organization's intended retention policy. Confirm with your technical team what enforcement is currently active before relying on it for a compliance requirement.
- The organization's audit log records every session creation, recording-finalization, removal, settings change, and job retry, each with who performed it and when — useful for answering "who did what" during an incident review.

---

## 8. Appendix — Status & Stage Reference

### Session status

| Status | Meaning |
|---|---|
| Draft | Session created, recording hasn't started |
| Recording | Actively capturing audio |
| Paused | Trainer clicked Pause — no audio is being captured; Resume continues the same session |
| Processing | Recording finished; transcription and AI analysis running |
| Completed | Transcript and summary are ready |
| Failed | Processing hit an error |

### Processing stage

| Stage | Meaning |
|---|---|
| Queued | Waiting to begin |
| Transcribing | Converting the recording to text, segment by segment |
| Merging transcript | Combining all segments into one session transcript |
| AI analysis | Generating the executive summary, key points, questions, and action items |
| Saving | Writing the final results |
| Completed | Finished |
| Failed | An error occurred |
