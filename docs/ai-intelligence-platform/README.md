# AI Intelligence Platform — Documentation Index

**Document version:** 1.1
**Last reviewed:** 2026-08-02
**Reflects:** the AI Intelligence Platform as implemented in production (session recording, transcription, and AI summarization).

This documentation set is split by audience and delivered both as Markdown (source of truth, version-controlled in this repository) and as professionally formatted Microsoft Word documents for client handover.

---

## 1. Client Documentation

For TerraNext Global Ventures staff — trainers, programme coordinators, operations managers, system administrators, and founders who use the platform day to day.

| Document | Audience | Contents |
|---|---|---|
| [Client 01 — User Guide](client/01-user-guide.md) | All staff with platform access | Platform overview, complete workflow, every screen, recording a session, reviewing results, troubleshooting, FAQ |
| [Client 02 — Administrator Guide](client/02-administrator-guide.md) | System Administrators, Founders | Roles & access matrix, Settings, AI provider setup, session management, troubleshooting, FAQ |
| [Client 03 — Operations Manual](client/03-operations-manual.md) | System Administrators, Operations staff | Daily checklist, monitoring, incident response, routine maintenance, escalation path |

## 2. Internal Engineering Documentation

For the engineering team that builds, deploys, and maintains this module.

| Document | Audience | Contents |
|---|---|---|
| [Engineering 01 — Technical Architecture Guide](engineering/01-technical-architecture.md) | Architects, senior engineers | System/sequence/pipeline/database diagrams, security architecture, module boundary |
| [Engineering 02 — Developer Guide](engineering/02-developer-guide.md) | Engineers extending the module | File map, exact data model, constants, component reference, security patterns, extension guide |
| [Engineering 03 — API & AI Workflow Guide](engineering/03-api-workflow-guide.md) | Engineers integrating with server actions / the AI pipeline | Server action contracts, provider call-level mechanics, processing stage matrix, debugging checklist |
| [Engineering 04 — Known Limitations & Engineering Notes](engineering/04-known-limitations-and-engineering-notes.md) | Engineering team, technical leads | Every implementation limitation, enhancement opportunity, technical-debt item, provider consideration, and performance consideration |
| [Engineering 05 — Installation & Deployment Guide](engineering/05-installation-deployment-guide.md) | Engineers/DevOps | Prerequisites, environment variables & secrets, deployment steps, verification, rollback |

---

## 3. Word Document Deliverables

The same eight documents (Client 01–03, Engineering 01–05) are also produced as enterprise-formatted `.docx` files for direct client handover, in [word-documents/](word-documents/):

- `AI Intelligence Platform - User Guide.docx`
- `AI Intelligence Platform - Administrator Guide.docx`
- `AI Intelligence Platform - Technical Architecture Guide.docx`
- `AI Intelligence Platform - Developer Guide.docx`
- `AI Intelligence Platform - API & AI Workflow Guide.docx`
- `AI Intelligence Platform - Known Limitations & Engineering Notes.docx`
- `AI Intelligence Platform - Operations Manual.docx`
- `AI Intelligence Platform - Installation & Deployment Guide.docx`

Each has a TerraNext cover page, document control table, version history, an automatic table of contents (Word field — right-click → Update Field after opening), headers/footers with page numbers, enterprise diagrams and wireframe illustrations, and Note/Warning/Best Practice callout boxes. The Markdown files above remain the source of truth for future edits — regenerate the Word documents from them rather than editing the `.docx` files directly.

---

## Maintenance

This is a living document set. When the implementation changes, update the relevant Markdown document(s) **and** bump the version header at the top of each changed file in the same change, then regenerate the corresponding Word document. Engineering Doc 04 is the single place implementation gaps are recorded — new gaps discovered later should be added there, not scattered back into the client-facing guides.
