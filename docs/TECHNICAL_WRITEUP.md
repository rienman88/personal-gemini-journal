# Personal Gemini Journal — Full Technical Writeup

This document explains the current implementation, its security boundaries, and the verification evidence behind it. It is written for a technical reviewer who does not have the rest of the project history.

The complete evaluator-facing feature matrix and reviewer prompt are in [EVALUATION_DOSSIER.md](EVALUATION_DOSSIER.md). This writeup supplies the deeper implementation rationale; it does not replace the distinction between locally verified behavior and externally verified production deployment.

## 1. What this is being built for

This repository is scoped to the [Google Cloud Gen AI Academy APAC Edition, Cohort 3](https://hack2skill.com/event/apac-genaiacademy?tab=cohort3&utm_source=hack2skill&utm_medium=homepage) ideathon, whose focus is Accelerate AI with Cloud Run. The build requirements are an authenticated AI application using Firebase Authentication, Firestore, Gemini, Secret Manager, and Cloud Run, plus an original feature enhancement. The intended evaluation pillars are **Authenticity**, **Usability**, **Stability**, and **Security**. The codelab's Custom Instructions are captured in `CONSTITUTION.md`; Google Cloud deployment, AI Studio configuration, social/demo publication, and Academy dashboard submission status must still be verified outside the repository.

## 2. Architecture — what was built, and why this shape specifically

![Personal Gemini Journal architecture](docs/ARCHITECTURE.svg)

This source-controlled diagram is the visual map of the implementation described in this document. It includes the production Cloud Run service boundary and the separate retention control plane; it does not represent an unimplemented service or a second frontend host.

```
Browser (Firebase Auth, Google Sign-In, Firebase App Check)
  → Cloud Run (one container, Express)
      → requireAuth middleware: verifies the Firebase ID token
      → requireAppCheck middleware: verifies `X-Firebase-AppCheck` when `ENFORCE_APP_CHECK=true`
      → CORS allowlist, COOP header, and 1 MB JSON body limit
      → /api/entries, /api/entries/:id/reply, /api/entries/:id/delete, /api/verify-integrity, /api/delete-data
          → Privacy Guardian (deterministic scan, runs before every Gemini call)
          → Gemini, via a 6-model fallback ladder
      → Firestore write, hash-chained
  Cloud Scheduler → /internal/retention/redact (worker token)
      → backend-only retention redaction
      → serves the built React frontend for every other route
  → Firestore reads happen directly from the browser (allowed by security rules for the owner)
```

The frontend surface includes Google authentication, entry composer, Privacy Guardian modal, live entry feed, multi-turn reply thread, related-entry category graph, side calendar, Security Activity drawer, integrity control, individual deletion modal, and all-journal deletion modal. All browser inputs include labels and Grammarly suppression attributes where applicable; deletion and Privacy Guardian actions preserve actionable errors rather than hiding failures.

Firebase Auth persistence is explicitly configured as `browserLocalPersistence` in `web/src/firebase.ts`, and `AuthGate` waits for that configuration before starting popup or redirect sign-in. This preserves the normal Firebase trusted-device experience across reloads and browser restarts until explicit sign-out or Firebase invalidation. It is browser-local Auth state, not a custom application cookie or server session; users must sign out on shared or public devices.

Specific choices and the reasoning:

- **One Cloud Run service serving both the API and the built frontend**, not a separate static host. The mandatory rule asks for a "publicly accessible URL of your deployed project on Cloud Run" — if the frontend lived elsewhere, that URL would just be a bare API response, not the actual usable app a judge can click into. `server/src/index.ts` serves `express.static` from the frontend's build output and falls through to `index.html` for any non-`/api` route.
- **Express with manual token verification, not Firebase Callable Functions.** Callable Functions verify the caller's ID token automatically; a plain Cloud Run service doesn't have that for free. This is a real trade-off, not a free upgrade — it's the direct reason `server/src/middleware/auth.ts` exists at all:

```typescript
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const idToken = header.slice("Bearer ".length);
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: "unauthenticated" });
  }
}
```

  `req.uid` is set only from a cryptographically verified token — never from anything the client sends in the request body. Every route trusts `req.uid` and nothing else for identity.

- **Google Sign-In only, not email/password.** The challenge's own Custom Instructions explicitly rule out handling passwords in application code ("Prefer Federated Identity... to outsource credential management securely"). This also removes password-related attack surface entirely, not just a compliance checkbox. Firebase Auth uses explicit browser-local persistence for the trusted-device flow; the application does not create a session cookie or server-side session.
- **App Check as a secondary boundary, not an identity replacement.** Firebase Auth establishes the user identity. When `ENFORCE_APP_CHECK=true`, `requireAppCheck` verifies the browser's reCAPTCHA Enterprise-backed token before the journal router. Local emulator mode keeps App Check disabled so Auth and Firestore emulators remain usable.

## 3. The core design thesis

Auth + Firestore + Gemini + Secret Manager is the baseline. The differentiating design is: **Gemini is treated as an interpreter, never an authority.** It summarizes, tags, and converses — but a separate, deterministic layer decides who can access what, whether a security rule applies, and what actually gets stored. Three control points enforce that boundary:

| Boundary | Mechanism |
|---|---|
| Before Gemini | Privacy Guardian — deterministic regex scan for secrets/PII, on every entry *and* every conversation reply; user chooses redact or send anyway |
| Before API handler | Firebase Auth identifies the user; Firebase App Check adds an attested-application signal for the public custom API |
| During | Bounded retry within a model (schema self-correction) + a 6-model fallback ladder |
| After | RAW (immutable, hash-chained) vs. DERIVED (Gemini's output, always labeled and never overwriting the original) |

The application also has independent state and cost boundaries after authentication: Firestore rules protect reads, Admin SDK writes bypass client mutation, the per-user rate limiter allows 8 requests per minute, the daily budget allows 50,000 reported tokens, and the retention worker is isolated behind a separate worker credential.

## 4. Complete file inventory

**`server/`** (Express, deploys inside the Cloud Run container):
- `src/index.ts` — app entry: CORS allowlist, JSON body parsing, mounts `requireAuth` + the API router, serves the built frontend for everything else
- `src/middleware/auth.ts` — Firebase ID token verification (quoted above)
- `src/middleware/appCheck.ts` — Firebase App Check verification for the custom API, controlled by the production enforcement flag
- `src/routes/journal.ts` — authenticated journal, deletion, and integrity endpoints (full logic in §5)
- `src/routes/retention.ts` — private scheduled redaction endpoint
- `src/middleware/retentionWorker.ts` — constant-time worker-token check
- `src/lib/piiDetector.ts` — Privacy Guardian: regex patterns + redaction
- `src/lib/geminiClient.ts` — the only file that calls Gemini; the fallback ladder and shared helper (full logic in §6)
- `src/lib/hashChain.ts` — the one hash primitive reused everywhere something needs to be tamper-evident
- `src/lib/rateLimiter.ts` — per-user sliding-window limit via a Firestore transaction
- `src/lib/audit.ts` — security-event log, separate from journal content
- `src/lib/retention.ts` — archive, tombstone, and delayed redaction lifecycle
- `test/appCheck.test.ts` — local enforcement boundary tests for disabled and missing-token cases
- `test/appCheck.test.ts`, `test/security.test.ts`, `test/stability.test.ts`, `test/retention.test.ts`, `test/authenticity.test.ts` — organized by judging pillar, not by file type

**`web/`** (React + Vite, built into static files the server hosts):
- `src/firebase.ts`, `src/lib/api.ts` — client SDK init and an authenticated-fetch wrapper (replaces `httpsCallable` now that the backend is plain Express)
- `src/lib/piiDetector.ts` — a byte-for-byte copy of the server's detector, used only for instant client-side preview; the server's copy is what's actually trusted
- `src/lib/topicGraph.ts` — the category graph (§7)
- `src/components/AuthGate.tsx` — Google Sign-In, with a redirect fallback if the popup is blocked
- `src/components/JournalEntryForm.tsx`, `PrivacyGuardianModal.tsx` — the composer and the redact/send-anyway choice
- `src/components/ConversationThread.tsx` — the multi-turn reply UI, scoped to one entry
- `src/components/JournalList.tsx`, `RelatedEntries.tsx` — the live entry feed and the category-graph output
- `src/components/JournalCalendar.tsx` — the derived calendar view over the live entry snapshot
- `src/components/SecurityActivity.tsx` — the signed-in user's recent audit-event view
- `src/components/DeleteDataModal.tsx` — the journal-data deletion confirmation flow
- `src/components/DeleteEntryModal.tsx` — individual entry deletion confirmation flow
- `src/components/IntegrityBadge.tsx` — on-demand hash-chain verification

**Root:** `Dockerfile` (multi-stage: builds `web/`, builds `server/`, copies both into a lean runtime image), `cloudbuild.yaml` (explicit Docker build and Artifact Registry push), `scripts/provision-cloud-run.ps1` (separate build/runtime service accounts, least-privilege IAM, App Check build/runtime settings, image deployment, label, and scheduler), `firestore.rules`, `firestore.indexes.json`, `package.json` (orchestrates `web/` + `server/` builds into one `npm start`), `CONSTITUTION.md` (the AI Studio Custom Instructions), `README.md`, `IMPLEMENTATION_GUIDE.md`, `SELF_DEPLOYMENT_GUIDE.md` (implementation-specific self-deployment procedure), `DOCKER_DEPLOYMENT_RUNBOOK.md` (Docker implementation record), `CLOUD_IMPLEMENTATION_RUNBOOK.md` (actual Google Cloud implementation record), `GITHUB_PUBLICATION_CHECKLIST.md` (repository publication boundary and credential audit), `HOW_IT_WORKS.md` (plain-language version of this document), `USABILITY_CHECKLIST.md`, and `TEST_RESULTS.md` (manual verification evidence).

## 5. How entry creation and multi-turn conversation actually work

`POST /api/entries`, in the exact order the code runs:
1. Reject if unauthenticated (`req.uid`, never a client field).
2. Trim and bound input (max 8000 chars); reject empty content or a missing `clientRequestId`.
3. **Idempotency check** — if this `clientRequestId` already produced an entry, return that entry instead of writing a duplicate. Protects against a flaky-network double-submit creating two entries.
4. Enforce the per-user rate limit.
5. **Privacy Guardian runs server-side** (the client may have already shown a warning, but that can be bypassed, so this is the check that's actually trusted). If matches exist and the user didn't explicitly acknowledge sending as-is, a redacted copy is built for Gemini — **the hash and the stored `content` always commit to the original, unredacted text; only the Gemini-bound copy is ever altered.**
6. Call Gemini through `analyzeEntry` (ladder + schema retry inside).
7. **One Firestore transaction**: read the current chain head, compute `sha256(prevHash|uid|content|createdAt)`, write the entry (RAW `content` and DERIVED `summary`/`topics`/`categories`/`reflection` together on one doc), advance the chain head.
8. **Seed the conversation subcollection** with Gemini's own reflection question as turn 0, hash-chained off the *entry's own hash* — the entry anchors its own thread.
9. Audit events for PII detection (if any), a Gemini fallback (if it happened), and entry creation.
10. Respond only after every write above has actually committed — never reports success before persistence.

Every new active entry also carries `deletionState: "active"`. This is explicit lifecycle state, not a new read path; existing entries without the field are treated as active by the UI and rules.

`POST /api/entries/:entryId/reply` follows the same shape, with two things worth being explicit about since they're easy to get wrong:
- **Privacy Guardian runs again, on the reply text specifically** — a secret can be typed into message five of a conversation as easily as into the first entry, and it would be a real gap if this only ran once.
- **Context sent to Gemini is bounded to the last 10 turns**, even though the full thread is fetched, stored, and displayed in full:

```typescript
const historySnap = await conversationRef.orderBy("createdAt", "asc").get();
const fullHistory: ConversationTurn[] = historySnap.docs.map(/* ... */);
const CONTEXT_WINDOW_TURNS = 10;
const history = fullHistory.slice(-CONTEXT_WINDOW_TURNS);
history.push({ role: "user", text: geminiInput });
```
This exists specifically because the first version of this route sent the *entire* thread on every reply, which meant token cost and latency grew without bound as a conversation got longer. The fix keeps "reply as long as you like" true from the user's side while keeping what's actually sent to the model fixed-size.

Hash-chaining for a reply uses whichever is more recent — the last conversation turn, or the entry itself if this is the first reply — so a conversation's tamper-evidence is continuous with the entry it's attached to, not a separate, disconnected chain.

## 6. Privacy-safe deletion lifecycle

`POST /api/entries/:entryId/delete` authorizes the operation from `req.uid`, then:

1. Marks the entry `deleting` before reading the archive snapshot. The UI filters this state and the reply route returns `410`, closing the concurrent-write race.
2. Copies the full entry to `users/{uid}/retentionEntries/{entryId}` and each conversation turn to the flat `retentionTurns` collection. These collections have explicit `allow read, write: if false` rules and are accessed only by the Admin SDK.
3. Replaces the active entry with a minimal `deletionState: "deleted"` tombstone containing the original `createdAt`, `prevHash`, and `hash`, plus `deletedAt`, `redactAt`, and `deletedByUidHash`.
4. Removes active conversation documents. The active journal listener therefore removes the entry from both the feed and the derived calendar without a second calendar record.
5. Writes an `entry_deleted` audit event without journal text.

`POST /api/delete-data` repeats that lifecycle for every active entry and preserves `users/{uid}/meta/chain`. Keeping the chain head is necessary so future entries append after the deleted history instead of silently starting a new chain. It writes one metadata-only `data_deleted` event for the journal scope.

The private `POST /internal/retention/redact` endpoint processes due retention entries. It is protected by `RETENTION_WORKER_TOKEN` and should be called daily by Cloud Scheduler. After `redactAt`, it overwrites the retained entry with `content`, `reflection`, and `summary` set to `Deleted`, empties `topics` and `piiDetected`, omits categories, and redacts conversation `text` while preserving minimal timestamps, hashes, role/order, retention state, and the HMAC actor identifier. This is delayed redaction, not a Firestore TTL delete.

## 7. The Gemini client: fallback ladder and verified recovery behavior

```typescript
const MODEL_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];
```
This is the current configured ladder. `generateContentWithFallback` is a single shared helper both `analyzeEntry` (structured JSON output) and `continueConversation` (plain-text replies) route through, rather than each re-implementing ladder-walking. Structured analysis makes at most three attempts per model, for a maximum of 18 attempts across the six-model ladder; the bound is intentional for cost and latency control.

Building that shared helper introduced two real regressions, both caught by re-running the test suite immediately afterward rather than being caught later or not at all:

1. **A non-retryable Gemini error would have thrown all the way up to the route**, failing the *entire* entry save over a Gemini problem unrelated to the user's words — directly contradicting the constitution's own "never fail silently, the user's input must persist" rule. Fixed by making the shared rung-runner swallow *any* failure (not just the four named retryable codes) and always return null, so `analyzeEntry`/`continueConversation` can never throw — they only ever resolve to a success or a graceful `{ok: false}`.
2. **A malformed (non-JSON) response was abandoning a model after one attempt instead of the intended three.** `JSON.parse` failing wasn't caught locally inside the schema-retry loop, so it escaped to the outer handler and looked identical to a hard API failure. Fixed by giving the parse its own local `try/catch` inside the loop, so a parse failure retries the *same* model with corrective feedback (as bounded self-correction is supposed to work), while an actual `call()` failure still abandons the model immediately and moves to the next rung.

Both fixes are verified by the test suite actually failing, then passing, not by re-reading the code and assuming it's correct.

## 8. The category graph

```typescript
export function buildCategoryGraph(entries: GraphableEntry[]): CategoryGraph {
  const graph: CategoryGraph = new Map();
  for (const entry of entries) {
    for (const category of entry.categories ?? []) {
      const key = category.trim().toLowerCase();
      if (!key) continue;
      if (!graph.has(key)) graph.set(key, new Set());
      graph.get(key)!.add(entry.id);
    }
  }
  return graph;
}
```
Runs entirely client-side, from entries already loaded for the list view — no new Firestore read, no new Gemini call. It clusters on `categories` (a closed, fixed 8-value set Gemini must choose from) rather than the free-form `topics` field, because `topics` is worded differently from entry to entry and would silently fragment related-entry grouping.

## 9. Verification performed, and what's still open

**A fourth control worth naming explicitly: per-user daily token budget, not just request-rate limiting.** The request limiter allows up to 8 requests per minute per user. The daily token budget catches a lower-frequency pattern of expensive calls that stays below that request threshold. `enforceTokenBudget` checks `users/{uid}/usage/{date}` before a Gemini call; `recordTokenUsage` increments it afterward with reported usage, including tokens spent on attempts that were retried or ultimately failed. A billing alert is recommended for visibility; an automatic billing shutdown is not part of this application.

**Actually verified, not just written:**
- `tsc --noEmit` compiles clean on both `server/` and `web/` against the real, installed `@google/genai`, `firebase-admin`, `express`, and React type definitions.
- `vite build` succeeds; the compiled server was actually run and hit with `curl` — confirmed it serves the real built `index.html` (this caught a real off-by-one in the static-file path during development) and that `/api/entries` returns 401 for both a missing and a garbage auth token.
- The pure-logic test suite passes: Privacy Guardian detection/redaction (including on replies), the fallback ladder (including both regressions above, now fixed), conversation continuation, and the static no-mock-provider guard.
- The emulator-backed server suite passes with 34 passing and 2 intentionally pending specs. The passing set includes App Check middleware behavior, retention redaction logic, worker-token authentication, legacy-entry compatibility, and Firestore rules isolation for entries, conversation turns, audit records, and retention records.
- The browser smoke suite passes with 4 tests: both Privacy Guardian decisions unmount the modal while the request remains pending, individual deletion closes after confirmation, the integrity badge distinguishes total/pending/visible counts, and Calendar v1 marks, counts, and navigates to journal dates without mobile horizontal overflow.
- The original manual execution log records 9 of 9 passed checks across entry creation, multi-turn replies, authentication persistence, Privacy Guardian interception, integrity verification, audit activity, category clustering, and raw Firestore inspection. `TEST_RESULTS.md` now adds the feature-by-feature manual matrix and marks operator-only checks separately.

The browser smoke tests additionally prove that both Privacy Guardian decisions unmount the modal immediately while the request remains pending, individual deletion closes after server confirmation, and Calendar v1 remains usable at 375px width.

**Verified staging, with final gates kept explicit:**
- A real Cloud Run deployment has occurred in the target project. Revision `personal-gemini-journal-00018-qqb` serves image tag `release-20260904-integrity-counts` with `ENFORCE_APP_CHECK=true`, `/health` returns HTTP 200, both current hostnames load their shells, the runtime identity is dedicated, and the required cohort label is present.
- Secret Manager bindings, the ready retention index, protected worker route, and enabled Scheduler invocation have been verified in staging. The valid empty-batch worker response and Scheduler HTTP 200 do not substitute for a due-record redaction test.
- App Check code support and Cloud Run enforcement are complete, but Firebase Console Web-app registration confirmation and final valid-token/missing-token browser testing are external release steps.
- The live Gemini authenticity test runs only when `GEMINI_API_KEY_TEST` is supplied, and the route-level idempotency test remains a named pending specification until a complete route harness is added.
- Free-tier Gemini usage may be reviewed by humans and used to improve Google's products; paid-tier usage explicitly is not — a real, disclosed tension for a privacy-positioned journal app.

## 10. Security Activity and deletion semantics

`SecurityActivity.tsx` reads the signed-in user's most recent audit events directly through an owner-scoped Firestore listener. The panel is read-only and never exposes journal text, secrets, or another user's records.

The deletion routes hide journal entries immediately but do not physically delete active chain nodes. Full records move to backend-only retention storage for up to 30 days; the scheduled worker then replaces user text and sensitive derived metadata with privacy-safe markers. The active hash chain remains verifiable through tombstone linkage, the chain head remains available for future entries, and the audit trail records `entry_deleted`, `entry_redacted`, or `data_deleted` without journal content.

## 11. Current open items

- A Cloud Run deployment is live on revision `personal-gemini-journal-00018-qqb` with dedicated IAM bindings, the immutable `release-20260904-integrity-counts` image digest `sha256:136da7af3d052ae1256b530ff509980e0929d529426849210e944d5ead013910`, corrected Secret Manager bindings, the cohort label, a ready retention index, an enabled daily scheduler, and `ENFORCE_APP_CHECK=true`. Manual worker/Scheduler requests return HTTP 200, and both current hostnames pass shell and health checks. Authenticated browser App Check validation, production latency testing, and a controlled due-record redaction run remain explicit release gates.
- Firebase App Check must still be confirmed in the Firebase Console Web-app registration and validated through the live browser request path.
- The live Gemini authenticity test runs only when `GEMINI_API_KEY_TEST` is supplied.
- The route-level idempotency test remains a named pending specification until a complete route harness is added.
- Production delayed redaction remains an operational verification item until a due record has been processed successfully by the configured daily Cloud Scheduler job.

For reviewers, the source-of-truth deployment procedure is `SELF_DEPLOYMENT_GUIDE.md`, the Docker procedure is `DOCKER_DEPLOYMENT_RUNBOOK.md`, and the actual execution record is `CLOUD_IMPLEMENTATION_RUNBOOK.md`, together with `scripts/provision-cloud-run.ps1` and `cloudbuild.yaml`. The implementation creates separate user-managed build and Cloud Run runtime service accounts, binds `roles/datastore.user` and per-secret `roles/secretmanager.secretAccessor`, builds and pushes an immutable Docker image with public frontend configuration, supports staged App Check registration, applies the cohort label, and creates or updates the daily retention scheduler.
