# Personal Gemini Journal - Evaluation Dossier

**Version:** 1.1 feature-complete staging reference  
**Status date:** September 4, 2026  
**Programme:** [Google Cloud Gen AI Academy APAC Edition, Cohort 3](https://hack2skill.com/event/apac-genaiacademy?tab=cohort3&utm_source=hack2skill&utm_medium=homepage)  
**Theme:** Accelerate AI with Cloud Run

## Purpose

This is the single evaluation brief for a reviewer or another AI system. It describes the implementation that exists in this repository, the local test evidence, the verified staging Cloud Run deployment, and the Google/Firebase and Academy actions that remain operator-controlled. It does not claim that final App Check enforcement, every live user flow, or Academy submission has already happened.

## Executive summary

Personal Gemini Journal is a private, user-authenticated journaling application. A signed-in user can write entries, receive a structured Gemini summary, topics, fixed categories, and a reflection prompt, then continue each entry as an isolated conversation. The application treats Gemini as an interpreter rather than an authority: Firebase Auth and App Check control access, deterministic server code controls privacy and persistence, Firestore rules enforce client read isolation, and Gemini output is stored as clearly labeled DERIVED data.

The differentiating feature is the privacy and integrity lifecycle around AI journaling:

- Privacy Guardian scans initial entries and every reply for likely secrets and PII before Gemini receives text.
- Users choose whether detected content is redacted for Gemini or explicitly sent as-is; the saved RAW text remains unchanged.
- Every entry and conversation turn is hash-chained for tamper evidence.
- Deleting one entry or the entire journal hides it immediately, preserves the active chain with a tombstone, retains protected records for 30 days, and then redacts readable journal material while retaining minimal cryptographic and audit metadata.
- The calendar and related-entry graph are derived from the live entry snapshot, so deletion cannot leave orphaned UI state or a second calendar data path.

## Complete feature inventory

| Area | Implemented capability | Evidence or source |
| --- | --- | --- |
| Authentication | Google Sign-In through Firebase Authentication; popup first, redirect fallback if popup fails; explicit `browserLocalPersistence` for trusted-device sessions; sign-out; auth-state loading and session listener; no custom application session cookie | `web/src/firebase.ts`, `web/src/components/AuthGate.tsx` |
| User isolation | Verified Firebase ID token; server derives `req.uid`; Firestore rules scope reads to `/users/{uid}/...`; cross-user and unauthenticated reads denied | `server/src/middleware/auth.ts`, `firestore.rules` |
| App authenticity | Firebase App Check client initialization with score-based reCAPTCHA Enterprise; token sent as `X-Firebase-AppCheck`; Admin SDK verification on every `/api` route when `ENFORCE_APP_CHECK=true` | `web/src/firebase.ts`, `web/src/lib/api.ts`, `server/src/middleware/appCheck.ts` |
| Entry creation | Bounded 8,000-character input, required client request ID, idempotent duplicate protection, server Privacy Guardian scan, Gemini analysis, Firestore persistence | `server/src/routes/journal.ts` |
| AI analysis | Structured summary, up to five topics, one or two closed-set categories, and one reflection question | `server/src/lib/geminiClient.ts` |
| Multi-turn conversation | Reply input bounded to 2,000 characters; each entry has an isolated conversation subcollection; full thread is displayed and latest 10 turns are sent to Gemini | `server/src/routes/journal.ts`, `web/src/components/ConversationThread.tsx` |
| Gemini resilience | Six-model fallback ladder; three structured-output attempts per model, for at most 18 structured attempts; plain replies use the ladder; malformed or unavailable AI never prevents RAW save | `server/src/lib/geminiClient.ts` |
| Privacy Guardian | Detects AWS keys, Google API keys, generic secret assignments, email, phone, and US SSN patterns; redacts only the Gemini-bound copy; UI modal closes immediately on either decision | `server/src/lib/piiDetector.ts`, `web/src/components/PrivacyGuardianModal.tsx` |
| RAW/DERIVED separation | User text remains RAW; Gemini summary, topics, categories, reflection, and model replies are DERIVED and labeled in the UI | `server/src/routes/journal.ts`, `web/src/components/JournalList.tsx` |
| Integrity | SHA-256 entry chain begins at `GENESIS`; conversation chains anchor to the entry hash; integrity endpoint checks active entries, tombstones, and conversations | `server/src/lib/hashChain.ts`, `server/src/routes/journal.ts` |
| Security activity | Read-only owner-scoped audit drawer for entry creation, replies, PII detection, Gemini fallback, rate limits, auth rejection, integrity checks, deletion, and redaction | `server/src/lib/audit.ts`, `web/src/components/SecurityActivity.tsx` |
| Rate and cost control | Eight requests per user per minute; 50,000 daily token budget; token accounting includes retries and failed model attempts; bounded Gemini output and context | `server/src/lib/rateLimiter.ts` |
| Category clustering and relationships | Closed-set categories: `work`, `relationships`, `health`, `finance`, `learning`, `personal-growth`, `creativity`, `other`; related entries share an allowlisted category; this is not vector or semantic search | `server/src/lib/geminiClient.ts`, `web/src/lib/topicGraph.ts` |
| Calendar | Side calendar derives marked dates from live entries, shows counts, supports month navigation and Today, and scrolls to the first entry on a selected date | `web/src/components/JournalCalendar.tsx` |
| Individual deletion | Confirmation modal; server archives the entry and turns, creates a chain-preserving tombstone, removes active conversation data, and immediately removes the entry from feed/calendar | `server/src/routes/journal.ts`, `server/src/lib/retention.ts`, `web/src/components/DeleteEntryModal.tsx` |
| All-journal deletion | Header action and confirmation modal; repeats privacy-safe deletion for all active entries, preserves the chain head, and keeps the audit trail | `server/src/routes/journal.ts`, `web/src/components/DeleteDataModal.tsx` |
| Retention redaction | Full records move to backend-only collections for 30 days; due records are redacted to `Deleted` text plus minimal metadata; conversation text is also redacted | `server/src/lib/retention.ts` |
| Retention worker boundary | Internal route requires a constant-time worker token and accepts a bounded batch limit; Cloud Scheduler provisioning is idempotent | `server/src/middleware/retentionWorker.ts`, `server/src/routes/retention.ts`, `scripts/provision-cloud-run.ps1` |
| Cloud Run hardening | Separate user-managed build and runtime service accounts, repository-scoped image push, `roles/datastore.user`, per-secret `roles/secretmanager.secretAccessor`, runtime project binding, required challenge label | `scripts/provision-cloud-run.ps1`, `cloudbuild.yaml` |
| Secret handling | Gemini key, deletion HMAC key, and retention worker token are runtime Secret Manager values; no runtime secret is a Docker build argument or frontend value | `.env.example` files, `Dockerfile`, `.dockerignore`, `.gcloudignore`, `DOCKER_DEPLOYMENT_RUNBOOK.md` |
| Browser quality | Mobile calendar layout, accessible labels/dialog roles, Grammarly suppression attributes on journal inputs, immediate modal feedback, retry-preserving errors | `web/src/components/*.tsx`, `web/smoke/*.spec.ts` |

## User journey

1. The visitor sees the sign-in screen and authenticates with Google.
2. Firebase publishes the auth state; the dashboard renders only for the signed-in user.
3. The user writes a journal entry and selects **Save entry**.
4. The browser may preview sensitive content, but the server performs the trusted Privacy Guardian scan.
5. If a match exists, the modal offers **Redact before sending to Gemini**, **Send as-is anyway**, or cancel. Either decision unmounts the modal immediately; the network save continues with the selected policy.
6. Gemini returns a structured summary, topics, categories, and reflection question, or the entry is still saved with `geminiOk: false` if the AI ladder fails.
7. The entry appears in the live feed with RAW text, DERIVED output, category pills, related entries, integrity shortcode, and an isolated conversation thread.
8. A reply follows the same Privacy Guardian boundary and is persisted as a user turn plus an optional model turn.
9. Security Activity shows metadata-only events. Integrity verification checks the entry and conversation chains.
10. The side calendar marks dates from the same live entries. Selecting a date navigates to the first matching entry and shows a count when multiple entries share a date.
11. Removing one entry or all entries hides the journal content and calendar markers immediately. The audit record remains.
12. After 30 days, the scheduled worker replaces retained content, reflection, summary, and conversation text with `Deleted`, removes sensitive derived metadata, and preserves minimal retention, deletion, actor-hash, timestamp, and cryptographic fields.

## Architecture and trust boundaries

![Personal Gemini Journal architecture](docs/ARCHITECTURE.svg)

The diagram is versioned with the application and reflects the actual source and deployment boundaries. It is a visual companion to the trust-boundary description below, not a proposed future architecture.

```text
Browser
  Firebase Auth / Google Sign-In
  Firebase App Check / reCAPTCHA Enterprise token
  Firestore owner-scoped realtime reads
  React dashboard, calendar, audit drawer, modals
        |
        | Bearer Firebase ID token + X-Firebase-AppCheck
        v
Cloud Run: one Node.js container
  Express CORS + COOP + JSON limits
  requireAuth -> requireAppCheck -> journal routes
  Privacy Guardian -> bounded Gemini fallback client
  Admin SDK Firestore writes -> hash chain + audit + usage
  Private retention route -> worker token -> redaction service
        |
        v
Cloud Firestore
  users/{uid}/entries
  users/{uid}/entries/{entryId}/conversation
  users/{uid}/retentionEntries
  users/{uid}/retentionTurns
  users/{uid}/meta/chain
  users/{uid}/usage/{UTC-date}
  users/{uid}/audit

Cloud Scheduler (daily)
  X-Retention-Worker-Token + bounded body
        -> /internal/retention/redact
```

The browser reads active entries, conversations, audit records, and metadata directly through Firestore because the rules can enforce owner isolation for reads. All writes, including entries, conversations, audit events, usage counters, tombstones, retention records, and redactions, use the Firebase Admin SDK on the backend. Firestore rules deny client writes and explicitly deny retention collection access.

## API surface

All `/api` routes require a verified Firebase ID token. In production, they also require a verified App Check token. The internal retention route uses its own worker-token boundary and does not use end-user auth.

| Method | Route | Behavior |
| --- | --- | --- |
| `POST` | `/api/entries` | Create an entry, apply rate/token controls and Privacy Guardian, call Gemini, persist RAW/DERIVED data, seed reflection turn, audit the result |
| `POST` | `/api/entries/:entryId/reply` | Append a user reply, enforce active-entry state, use bounded context, call Gemini, persist user/model turns, audit the result |
| `POST` | `/api/verify-integrity` | Recalculate entry and conversation chain linkage for the authenticated user, returning total records checked, pending-redaction count, and visible-entry count |
| `POST` | `/api/entries/:entryId/delete` | Archive one entry and its conversation, write a tombstone, remove active turns, return retention deadline |
| `POST` | `/api/delete-data` | Apply the same lifecycle to all active entries and preserve the chain head and audit trail |
| `POST` | `/internal/retention/redact` | Process due retention entries in a bounded batch; protected by `X-Retention-Worker-Token` |
| `GET` | `/health` | Return `ok` for Cloud Run health checks; `/healthz` remains supported locally |

Important behavior:

- A missing or invalid Firebase ID token returns `401`.
- When App Check enforcement is on, a missing or invalid App Check token returns `401` before the journal router.
- Invalid input returns `400`.
- Rate and token budget exhaustion returns `429`.
- Replying to a deleting or deleted entry returns `410`.
- Duplicate client request IDs return the original result rather than create duplicate data.
- Gemini failure returns a safe persisted result rather than losing the user's words.

## Data and privacy lifecycle

### Active entry

An active entry contains the verified owner UID, request ID, RAW content, timestamps, `prevHash`, `hash`, PII category metadata, redaction decision, Gemini status, and DERIVED fields. The entry's `hash` is `sha256(prevHash | uid | content | createdAt)`.

### Deleted entry

Deletion first marks the entry `deleting` to close the concurrent-reply race. The complete entry is copied to `retentionEntries`, conversation turns are copied to `retentionTurns`, active conversation documents are removed, and the active entry becomes a content-free tombstone. The tombstone keeps chain position and cryptographic fields plus `deletedAt`, `redactAt`, and `deletedByUidHash`.

### Redacted retention record

After the deadline, the worker retains the record but replaces `content`, `reflection`, `summary`, and conversation `text` with `Deleted`. It empties `topics` and `piiDetected`, omits `categories`, and retains only minimal lifecycle, actor-hash, timestamp, ownership, and hash metadata. The raw UID is not stored as the deletion actor identifier; production uses HMAC-SHA-256 with `DELETION_HMAC_KEY`.

## Security claims and honest limits

### Claims supported by code and local tests

- A client cannot select another user's UID for API writes because the server uses the verified token UID.
- A client cannot write fake entries, conversations, usage, audit events, or retention records directly through Firestore rules.
- Deleted conversations and backend-only retention records are not readable by the browser.
- Gemini never receives a secret or PII match when the user chooses the redaction action.
- Gemini output cannot authorize requests, execute tools, or write Firestore.
- A failed Gemini call does not discard the user's RAW entry or reply.
- Hash-chain verification detects broken active content and preserves deleted chain linkage with tombstones.
- App Check is fail-closed when explicitly enabled in production.

### Limits that must remain visible to an evaluator

- Privacy Guardian uses deterministic patterns; obfuscated, encoded, or novel secrets can evade it.
- Prompt injection is reduced by untrusted-data framing and non-authoritative output handling, not eliminated.
- App Check code is implemented and the current Cloud Run revision enforces it. Firebase Console Web-app registration confirmation and live valid-token success plus missing/invalid-token rejection remain release verification steps.
- Retention redaction code and scheduler provisioning are implemented. The live staging worker rejects invalid tokens, returns HTTP 200 for a valid empty batch, and the manual Scheduler invocation also returned HTTP 200; a controlled due-record transformation remains pending.
- The current worker scheduler uses a static secret header. OIDC Scheduler-to-Cloud Run authentication would be stronger but requires a separate internal/private worker architecture; it is not silently claimed here.
- A Cloud Run deployment is live on revision `personal-gemini-journal-00018-qqb` from image tag `release-20260904-integrity-counts` with immutable digest `sha256:136da7af3d052ae1256b530ff509980e0929d529426849210e944d5ead013910`, dedicated identities, corrected runtime secret bindings, cohort label, ready retention index, enabled Scheduler, and `ENFORCE_APP_CHECK=true`. Both current hostnames return HTTP 200 for the shell and health endpoint. Authenticated browser App Check success/rejection, production latency, IAM propagation, quotas, billing behavior, and controlled due-record retention transformation remain operator verification gates.
- One authenticity test is skipped without `GEMINI_API_KEY_TEST`; one route-level idempotency test remains a named pending specification because it needs a complete route harness.
- The previous frontend bundle warning above 500 kB was resolved by splitting Firebase vendor code; the current application and Firebase chunks are approximately 161 kB and 461 kB respectively, with no Vite warning.

## Verification evidence

### Automated local verification

| Verification | Result |
| --- | --- |
| Root production build | Passed |
| Server TypeScript build | Passed |
| App Check middleware tests | 2 passed |
| Emulator-backed server suite | 34 passed, 2 intentionally pending |
| Browser smoke suite | 4 passed |
| Privacy Guardian modal smoke | Both Redact and Send as-is unmount immediately while the request remains pending |
| Individual deletion smoke | Modal closes after server confirmation and reports removal |
| Calendar smoke | Marked dates, counts, navigation, and 375px overflow behavior pass |
| Provisioning script syntax | PowerShell parse passed |

### Manual execution log

The nine recorded manual checks all passed:

1. Plain entry creation produced summary, topics, and reflection.
2. Reply and related-entry category linkage produced the `work` badge and `RELATED` behavior.
3. Sign-out and Google re-authentication preserved session state.
4. Privacy Guardian intercepted an AWS access-key pattern on entry creation.
5. Privacy Guardian intercepted the same pattern on a reply.
6. Server-side SHA-256 integrity verification passed.
7. Security Activity showed real `entry_created` and `pii_detected` audit records.
8. Closed-set category clustering passed through the related-entry path.
9. Raw Firestore inspection confirmed hashes, `prevHash`, and conversation subcollections.

Full evidence and boundaries are in [TEST_RESULTS.md](TEST_RESULTS.md).

## External completion checklist

- [ ] Accept Firebase terms and enable Google Sign-In in the target Firebase project.
- [ ] Confirm the production score-based reCAPTCHA Enterprise key is registered to the Firebase Web app and its domains are correct.
- [x] Create `GEMINI_API_KEY`, `DELETION_HMAC_KEY`, and `RETENTION_WORKER_TOKEN` in Secret Manager.
- [x] Run `scripts/provision-cloud-run.ps1` with the protected `RETENTION_WORKER_TOKEN` and public Firebase build values.
- [x] Record the Cloud Build image URI and digest.
- [x] Verify the deployed revision uses the dedicated runtime service account and the image was built by the separate build service account.
- [x] Verify the required `dev-tutorial=cloud-run-ai-challenge` Cloud Run label.
- [ ] Verify normal App Check requests pass and missing/invalid App Check requests return `401`.
- [ ] Trigger a controlled retention run and observe `entry_redacted`.
- [x] Deploy and verify Firestore rules.
- [ ] Record the live Cloud Run URL, repository URL, and Academy submission evidence.

## Documentation synchronization checklist

- [x] README reflects the current feature set, architecture, local verification, deployment path, and limitations.
- [x] HOW_IT_WORKS reflects authentication, App Check, entry/reply behavior, calendar, related entries, audit activity, deletion, retention, and failure states.
- [x] IMPLEMENTATION_GUIDE and SELF_DEPLOYMENT_GUIDE reflect Firebase, Secret Manager, Cloud Run identity, App Check registration, scheduler setup, and Academy submission steps.
- [x] DOCKER_DEPLOYMENT_RUNBOOK records the actual Docker build, Cloud Run image deployment, runtime secret boundary, rollback, alternatives, errors, and execution checklist.
- [x] GITHUB_PUBLICATION_CHECKLIST records the repository publication boundary, local-only credential exclusions, dry-run review, and GitHub controls.
- [x] TECHNICAL_WRITEUP reflects current routes, middleware, data model, retention lifecycle, tests, and open production verification.
- [x] CONSTITUTION preserves the current architecture and defines the feature/security contract for Google AI Studio.
- [x] OWASP_LLM_TOP10_COVERAGE reflects current LLM controls, cross-cutting application controls, and honest limits.
- [x] TEST_RESULTS records the original nine manual checks, the complete feature-by-feature manual matrix, automated evidence, App Check tests, deletion tests, and external checks still required.
- [x] USABILITY_CHECKLIST covers the complete user-facing walkthrough and production usability/security checks.
- [x] Relative Markdown links resolve across all thirteen root documentation files.
- [x] Submission instructions identify Google Cloud Gen AI Academy APAC Cohort 3 rather than Devpost; historical nine-step results, retention semantics, and App Check gates are labeled accurately in the root documentation.
- [x] `docs/ARCHITECTURE.svg` reflects the current Auth, App Check, Cloud Run, Gemini, Firestore, Secret Manager, Scheduler, and retention paths.
- [x] Firebase Auth persistence is explicit browser-local persistence with no custom application session cookie; manual sign-out remains the user control for trusted-device sessions.

## Reviewer prompt

Evaluate this repository against **Authenticity, Usability, Stability, and Security**. Prioritize concrete evidence over claims. Check whether the implementation preserves user isolation, protects Gemini calls from accidental disclosure, handles AI failure without data loss, maintains deletion and hash-chain invariants, and accurately distinguishes local verification from external production readiness. Identify any security gaps, misleading documentation, missing tests, or unnecessary architectural complexity.

## Navigation

- [README.md](README.md) - project overview and quick start
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) - user-facing behavior and failure modes
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - Firebase, Secret Manager, Cloud Run, App Check, scheduler, and submission steps
- [SELF_DEPLOYMENT_GUIDE.md](SELF_DEPLOYMENT_GUIDE.md) - implementation-specific deploy-from-scratch workflow, verification, rollback, alternatives, and resolved issues
- [TECHNICAL_WRITEUP.md](TECHNICAL_WRITEUP.md) - implementation rationale and deeper engineering detail
- [DOCKER_DEPLOYMENT_RUNBOOK.md](DOCKER_DEPLOYMENT_RUNBOOK.md) - actual Docker build, Cloud Run image release, verification, rollback, alternatives, and execution log
- [CLOUD_IMPLEMENTATION_RUNBOOK.md](CLOUD_IMPLEMENTATION_RUNBOOK.md) - actual Google Cloud CLI, Firebase, Secret Manager, IAM, Cloud Build, Cloud Run, Scheduler, error, rotation, and verification record
- [GITHUB_PUBLICATION_CHECKLIST.md](GITHUB_PUBLICATION_CHECKLIST.md) - repository publication boundary, credential scan, dry run, included manifest, and GitHub controls
- [CONSTITUTION.md](CONSTITUTION.md) - Google AI Studio security instructions
- [OWASP_LLM_TOP10_COVERAGE.md](OWASP_LLM_TOP10_COVERAGE.md) - LLM threat coverage and limits
- [TEST_RESULTS.md](TEST_RESULTS.md) - manual and automated evidence
- [USABILITY_CHECKLIST.md](USABILITY_CHECKLIST.md) - usability walkthrough and production checks
