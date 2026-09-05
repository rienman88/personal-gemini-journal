# Personal Gemini Journal Submission Stack Map

## Purpose

This document maps the Google Cloud Gen AI Academy submission fields to the actual Personal Gemini Journal implementation. It is the public source of truth for explaining which services are used, what each service does, and where the implementation can be verified.

## Submission-ready brief description

Personal Gemini Journal is a user-authenticated AI journaling application deployed on Google Cloud Run. Firebase Authentication provides Google Sign-In and a verified Firebase user ID for each account. The Express API verifies that identity and derives user-scoped Firestore paths so journal data remains isolated between authenticated users. Cloud Firestore stores entries, multi-turn conversations, security activity, usage metadata, integrity metadata, and backend-only retention records.

Gemini is called only from the Cloud Run server through the `@google/genai` SDK. It generates structured summaries, topics, categories, reflection prompts, and contextual replies. Privacy Guardian scans AI-bound entries and replies before Gemini, while Private Journal gives the user a server-enforced option to save an entry without Gemini processing. Gemini API credentials, the deletion HMAC key, and the retention worker token are retrieved by Cloud Run from Google Cloud Secret Manager at runtime.

Firebase App Check with score-based reCAPTCHA Enterprise protects the public API from unauthorized application clients, while Cloud Run hosts the containerized frontend and backend. The application also includes a SHA-256 integrity chain, Security Activity audit events, category-based related entries, a derived journal calendar, individual and all-journal deletion, backend-only retention, and scheduled privacy redaction.

## Required service selections

Select and confirm all four mandatory services:

- [x] **User authentication via Firebase**
- [x] **Multi-turn interaction with the Gemini API**
- [x] **User-isolated Firestore document storage**
- [x] **Secure API key retrieval via Google Cloud Secret Manager**

## Others to mention

Use the following under **Others**, if the form allows multiple entries:

- Google Cloud Run
- Firebase App Check
- reCAPTCHA Enterprise
- Cloud Build
- Artifact Registry
- Cloud Scheduler
- Google Cloud IAM and dedicated service accounts
- Google AI Studio Build mode and Custom Instructions

## Why the additional capabilities were implemented

These capabilities are not decorative add-ons. Each one addresses a specific privacy, integrity, usability, abuse, or operational problem in an AI journaling application.

| Capability | Why it exists | User or evaluator benefit |
| --- | --- | --- |
| Privacy Guardian PII interception | Journal text can contain credentials, contact details, or other sensitive data. The server scans AI-bound entries and replies before Gemini receives them. | The user can redact detected matches before sending them to Gemini, while the original RAW journal text remains unchanged. |
| Firebase App Check with reCAPTCHA Enterprise | A valid Firebase user token identifies a user but does not prove that the request came from the real application. | Adds a second application-authenticity signal and rejects missing or invalid App Check requests in production. It complements Firebase Auth; it does not replace it. |
| Per-user rate limits and daily token budgets | Repeated requests can cause abuse, latency, or unexpected Gemini spending. | Limits rapid request bursts and expensive retry patterns for each UID while keeping normal journaling usable. |
| SHA-256 hash-chain integrity verification | A database record can be changed after it is written unless the application keeps tamper-evident links. | The server recalculates `hash` and `prevHash` links for entries and conversation turns and reports whether the chain remains intact. This is tamper evidence, not encryption. |
| Security Activity auditing | Security-relevant actions are difficult to understand when they are mixed into journal content. | A read-only, user-scoped activity view shows events such as creation, PII detection, replies, private notes, integrity checks, deletion, and redaction without exposing secrets in the audit record. |
| Category-based entry relationships | Users benefit from connections between entries, but a separate semantic-search system would add complexity and privacy surface. | A closed-set category graph provides predictable `Related` links for entries sharing an allowlisted category. It is intentionally not vector or semantic search. |
| Derived calendar | A second calendar database could drift from the actual journal and create another deletion path. | Calendar dates and counts are derived from visible entries, so navigation stays synchronized and deleting an entry automatically removes its calendar marker. |
| Individual deletion | Users need to remove one mistake or sensitive entry without destroying their whole journal. | The entry disappears from the feed and calendar immediately, while the protected retention and audit lifecycle preserves the documented evidence. |
| Delete All Journal Data | Users need a clear way to remove their complete visible journal. | All active entries and conversations are hidden in one confirmed operation; audit records remain and each deleted record follows the same retention lifecycle. |
| 30-day retention and scheduled privacy redaction | Immediate physical deletion would break the planned chain and audit model, while indefinite readable retention would be unnecessarily privacy-invasive. | Deleted content is hidden immediately, held in backend-only retention storage for the defined period, then replaced with `Deleted` while minimal lifecycle, cryptographic, and audit metadata remains. Cloud Scheduler invokes the worker so the promise is operational rather than documentation-only. |

## Other implemented capabilities that must not be omitted

The previous list is not the complete feature inventory. Include these capabilities when describing the product:

- **Google Sign-In and per-user UID isolation:** Firebase Authentication assigns the identity; Cloud Run derives ownership from the verified UID, and Firestore rules restrict client reads to that user's namespace.
- **AI Journal / Private Journal mode:** Each user can choose whether a new entry uses Gemini. Private Journal stores the original entry without Gemini, token usage, derived output, or model turns.
- **Private notes:** Private Journal supports clearly labeled user-authored notes up to 1,000 characters. They are authenticated, hash-chained, audited, deleted, and retained like other protected journal material, but never sent to Gemini.
- **Structured Gemini journaling:** AI Journal produces a summary, topics, allowlisted categories, a reflection question, and bounded contextual replies through a multi-turn conversation per entry.
- **Resilience and graceful degradation:** The server uses a six-model fallback ladder, bounded retries, input limits, and preserves the RAW entry when Gemini is unavailable.
- **RAW/DERIVED separation:** The user's original words remain distinct from Gemini-generated summaries, categories, reflections, and replies, which are labeled as derived content.
- **Storage segregation:** Entries, conversation turns, preferences, usage, audit events, chain metadata, and backend-only retention records use separate user-scoped Firestore paths.
- **Idempotent and validated requests:** Client request IDs prevent duplicate entry or reply writes, and server validation rejects empty or oversized requests before Gemini or persistence work.
- **Accessible journal interface:** Journal cards can expand or collapse, long content uses bounded scrolling, and calendar selection expands and scrolls to the selected entry.
- **Containerized production path:** Docker, Cloud Build, Artifact Registry, Cloud Run, dedicated build/runtime identities, Secret Manager, Cloud Scheduler, and the required Academy label provide a repeatable deployment boundary.

## Complete implementation map

| Stack layer | Service or technology | Actual responsibility | Source evidence |
| --- | --- | --- | --- |
| Secure development context | Google AI Studio Custom Instructions | Defines the security instructions used when creating and extending the application. It is a development aid, not the production authorization boundary. | `docs/CONSTITUTION.md`, `docs/IMPLEMENTATION_GUIDE.md` |
| Browser interface | React, TypeScript, Vite | Provides sign-in, journal composer, AI/private mode, Privacy Guardian modal, feed, replies, calendar, relationships, integrity status, Security Activity, and deletion controls. | `web/src/App.tsx`, `web/src/components/` |
| User authentication | Firebase Authentication with Google provider | Signs users in without the application handling passwords. Firebase supplies the authenticated UID. | `web/src/firebase.ts`, `web/src/components/AuthGate.tsx` |
| Application authenticity | Firebase App Check with reCAPTCHA Enterprise | Adds `X-Firebase-AppCheck` to API requests in production; the server rejects missing or invalid tokens when enforcement is enabled. | `web/src/firebase.ts`, `web/src/lib/api.ts`, `server/src/middleware/appCheck.ts` |
| Application API | Node.js, Express, Firebase Admin SDK | Verifies Firebase ID tokens, derives ownership from the verified UID, enforces journal mode, validates input, scans PII, calls Gemini, writes Firestore, and applies deletion/integrity rules. | `server/src/index.ts`, `server/src/middleware/auth.ts`, `server/src/routes/journal.ts` |
| AI processing | Gemini API through `@google/genai` | Generates structured entry analysis and bounded contextual replies through a server-only fallback ladder. | `server/src/lib/geminiClient.ts` |
| User data | Cloud Firestore | Stores owner-scoped entries, conversations, audit events, preferences, usage, chain metadata, and backend-only retention material. | `firestore.rules`, `firestore.indexes.json`, `server/src/routes/journal.ts` |
| Secret storage | Google Cloud Secret Manager | Supplies `GEMINI_API_KEY`, `DELETION_HMAC_KEY`, and `RETENTION_WORKER_TOKEN` to the Cloud Run runtime without putting values in the browser or image. | `scripts/provision-cloud-run.ps1`, `server/src/routes/journal.ts`, `server/src/lib/retention.ts` |
| Container runtime | Google Cloud Run | Runs the single container that serves the React frontend and Express API. Uses a dedicated runtime service account. | `Dockerfile`, `scripts/provision-cloud-run.ps1` |
| Image build and storage | Docker, Cloud Build, Artifact Registry | Builds the reviewed multi-stage Docker image and stores an immutable deployable image. | `Dockerfile`, `cloudbuild.yaml`, `docs/DOCKER_DEPLOYMENT_RUNBOOK.md` |
| Retention automation | Cloud Scheduler | Calls the protected retention endpoint on a daily schedule so deleted records can be privacy-redacted after the retention period. | `scripts/provision-cloud-run.ps1`, `server/src/routes/retention.ts` |
| Least privilege | Google Cloud IAM and service accounts | Separates the build identity from the Cloud Run runtime identity; runtime access is limited to Firestore and named secrets. | `scripts/provision-cloud-run.ps1`, `docs/THREAT_MODEL.md` |
| Privacy protection | Privacy Guardian and Private Journal | Detects documented PII/secret patterns before Gemini; Private Journal avoids Gemini entirely for that entry. | `server/src/lib/piiDetector.ts`, `server/src/lib/journalMode.ts`, `web/src/components/PrivacyGuardianModal.tsx` |
| Integrity and audit | SHA-256 chain and Security Activity | Links entries and conversation turns with `hash` and `prevHash`, recalculates integrity server-side, and records security events. | `server/src/lib/hashChain.ts`, `server/src/lib/audit.ts`, `web/src/components/IntegrityBadge.tsx`, `web/src/components/SecurityActivity.tsx` |
| Deletion lifecycle | Firestore retention paths and worker | Hides deleted entries immediately, preserves audit and chain evidence, retains protected records temporarily, and later replaces readable content with `Deleted`. | `server/src/lib/retention.ts`, `server/src/routes/retention.ts` |
| Quality verification | TypeScript, Mocha, Firebase emulators, Playwright | Verifies build integrity, App Check middleware, Firestore isolation, input limits, retention, fallback behavior, UI deletion, calendar, mode choice, and Privacy Guardian modal behavior. | `server/test/`, `web/smoke/`, `docs/TEST_RESULTS.md` |

## Plain-language data flow

```text
User
  -> Firebase Google Sign-In provides identity and UID
  -> Firebase App Check provides application-attestation token
  -> React sends authenticated request to Cloud Run
  -> Express verifies Firebase Auth and App Check
  -> Server decides AI Journal or Private Journal
  -> Privacy Guardian checks AI-bound text
  -> Gemini generates derived insight only when allowed
  -> Firebase Admin SDK writes owner-scoped Firestore records
  -> Cloud Scheduler later invokes protected retention redaction
```

## What should be visible in a demonstration

| Service | Safe visible evidence | Do not reveal |
| --- | --- | --- |
| Google AI Studio | Custom Instructions or `CONSTITUTION.md` and a short explanation of reviewed generation | Prompt history containing private data or credentials |
| Firebase Authentication | Google Sign-In, signed-in dashboard, sign-out, and re-authentication | Complete tokens or personal account details |
| Firebase App Check | Registered web app, reCAPTCHA Enterprise provider, header presence, valid request, missing/invalid request returning `401` | Full App Check JWT |
| Firestore | Sanitized `hash`, `prevHash`, `categories`, `createdAt`, and rules path | Raw private journal content or exported user data |
| Secret Manager | Cloud Run secret names with values hidden | Secret values, versions, tokens, or service-account keys |
| Cloud Run | Healthy service, current revision, 100% traffic, dedicated runtime identity, and `dev-tutorial=cloud-run-ai-challenge` label | Unnecessary project secrets or credentials |
| Gemini | Summary, topics, reflection, category, and contextual reply | Claims that Gemini controls authorization or persistence |

## Original contribution to emphasize

The strongest original feature is the **per-entry AI Journal / Private Journal decision**. The user does not have to choose between a fully manual journal and a journal that sends everything to AI. Each entry can independently use Gemini or remain outside Gemini processing.

The feature becomes stronger because it is connected to the rest of the lifecycle:

- Private Journal saves without Gemini, summaries, categories, reflections, token usage, or model replies, while allowing clearly labeled user-authored private notes.
- AI Journal uses Privacy Guardian before Gemini receives the content.
- The server, not the browser, enforces the selected mode.
- The calendar and related-entry graph are derived from visible entries.
- Integrity verification and Security Activity provide evidence of what happened.
- Deletion removes content from the user experience while preserving audit and chain continuity.

Use this sentence in the submission or video:

> My original contribution is a user-controlled AI privacy boundary: every journal entry can independently choose AI assistance or remain a Private Journal entry that never enters Gemini processing. Private notes remain user-authored and hash-chained, while both paths retain the same ownership, integrity, audit, calendar, deletion, and retention protections.

## Accurate security boundary

> Journal data is isolated per authenticated user and protected from unauthorized application clients. Privileged Google Cloud operators and the backend runtime remain trusted components.

This is intentionally not a zero-knowledge claim. The backend must be trusted because it performs server-side Gemini analysis, Firestore writes, retention processing, and integrity verification.
