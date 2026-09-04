# Hack2Skill Video Submission Script

## Purpose

This is the version 1 demonstration script for the Google Cloud Gen AI Academy APAC Edition, Cohort 3 submission. It is written for the current Personal Gemini Journal implementation and avoids claims that the system does not make.

The strongest story is not a feature tour. It is one complete privacy-aware journal lifecycle:

1. A user signs in with Google.
2. Gemini turns a reflection into structured, clearly labeled insight.
3. Privacy Guardian intercepts a fake credential before it is sent to Gemini.
4. Firebase App Check and Firebase Auth protect the API boundary.
5. The hash chain and Security Activity panel provide verifiable evidence.
6. Deletion removes the entry from the user experience while protected retention and audit behavior continue server-side.

## Accurate Security Claim

Use this wording in the video:

> Journal data is isolated per authenticated user and protected from unauthorized application clients. Privileged Google Cloud operators and the backend runtime remain trusted components.

Do not say that the application is zero-knowledge, administrator-blind, or that Google Cloud operators cannot access Firestore content. The backend must be trusted because it performs Gemini analysis, retention processing, and server-side integrity verification.

## Recording Profile

- Target length: approximately 3 minutes. Confirm the exact Cohort 3 limit in the Hack2Skill submission portal before recording.
- Format: one continuous story with short evidence cuts, not a console walkthrough.
- Demo account: a dedicated test Google account with no personal journal data.
- Demo data: fictional work notes only.
- Browser: use a clean profile or Incognito with Grammarly and unrelated extensions disabled.
- Display: record at a readable zoom level; hide bookmarks, personal tabs, account identifiers, and unrelated notifications.
- Audio: narrate the security reason for each action instead of reading implementation details line by line.

## Pre-Recording Checklist

Complete these items before recording. Do not mark an item as passed in the video unless it has been independently verified.

- [ ] Confirm the deployed Cloud Run URL and use a hard refresh.
- [ ] Sign in with the dedicated demo account.
- [ ] Confirm the current Cloud Run revision is serving 100% of traffic.
- [ ] Confirm the production build uses App Check and the server has `ENFORCE_APP_CHECK=true`.
- [ ] Confirm Firebase App Check is registered for the deployed web app with a score-based reCAPTCHA Enterprise site key and the correct production hostname.
- [ ] Confirm one valid authenticated request succeeds with `X-Firebase-AppCheck`.
- [ ] Confirm missing and invalid App Check requests return `401`.
- [ ] Prepare the fake credential `AKIAABCDEFGHIJKLMNOP`; never use a real secret.
- [ ] Prepare two entries that share a category so the Related indicator can be shown.
- [ ] Confirm the integrity verification result and Security Activity events are available.
- [ ] If retention evidence is shown, use only a controlled fixture and redact all readable content on screen.
- [ ] Blur or crop all Firebase ID tokens, App Check tokens, cookies, email addresses, project secrets, and raw Firestore journal content.
- [ ] Keep a second recording or screenshot of the detailed evidence in case the live demo is affected by network or model latency.

## Safe Demo Data

Use the following fictional entries. They are designed to exercise the real features without exposing personal data.

### Entry A

`Spent the morning refactoring Express routes and setting up Secret Manager for Gemini API keys.`

Expected visible result: a summary, topics such as Express routes and Secret Manager, a reflection question, a closed-set category such as `work`, and a calendar marker.

### Entry B

`I documented the backend deployment flow and reviewed how Cloud Run separates the frontend from runtime secrets.`

Expected visible result: a related-entry indicator when the category graph assigns a shared category.

### Privacy Guardian Input

`Testing a backup integration with AWS_KEY='AKIAABCDEFGHIJKLMNOP'.`

This is a deliberately fake AWS-style secret fixture for demonstration only. It is not an AWS integration or a real credential.

## Full Spoken Script and Shot List

### 0:00-0:15 - Opening

**On screen:** Show the deployed Personal Gemini Journal landing page or dashboard. Do not show browser bookmarks or personal account information.

**Say:**

> Private journaling should help people think, not turn their reflections into unguarded AI payloads. Personal Gemini Journal is an authenticated AI journal built on Firebase, Gemini, Firestore, and Cloud Run. This demonstration follows one entry from creation through privacy protection, verification, and deletion.

**On-screen caption:**

`Privacy-aware AI journaling with verifiable application boundaries`

### 0:15-0:30 - Google Sign-In and Per-User Identity

**On screen:** Click the Google Sign-In control. Complete sign-in with the dedicated demo account. Show the private dashboard and the signed-in state. Do not expose the email address; crop or blur it.

**Say:**

> Authentication is handled by Firebase Google Sign-In. The application does not handle passwords. Firebase provides a unique user ID, and the server derives the ownership boundary from the verified token. The client cannot choose another user's UID or redirect a request into another user's storage path.

**On-screen caption:**

`Firebase Auth -> verified uid -> owner-scoped API and Firestore paths`

### 0:30-0:55 - Create an AI Journal Entry

**On screen:** Paste Entry A into the journal composer and submit it. Wait for the result. Show the entry card, generated summary, topics, reflection question, category badge, and the calendar marker for the entry date.

**Say:**

> I am creating a normal work reflection. Gemini returns structured derived content: a summary, topics, a reflection prompt, and a category. The original user text remains RAW, while Gemini's response is labeled DERIVED. The calendar is computed from the live journal entries, so it does not create a second copy of the journal content.

**On-screen caption:**

`RAW user text != DERIVED Gemini output`

### 0:55-1:10 - Related Entry and Multi-Turn Context

**On screen:** Create Entry B, or use a previously prepared entry. Show the shared category-clustering result and `Related` indicator. Open the conversation area and submit a short safe reply such as:

`The deployment review made the boundary between application code and runtime secrets clearer.`

Show the in-context Gemini reply.

**Say:**

> The application uses closed-set category clustering: entries are related only when Gemini assigns them a shared category from the fixed allowlist. This is deliberately not semantic or vector search. Replies stay inside the selected entry's conversation. Gemini can generate insight, but it cannot authorize users, write Firestore directly, delete records, or call tools.

### 1:10-1:35 - Privacy Guardian

**On screen:** Start a new entry or reply using the Privacy Guardian input. Paste:

`Testing a backup integration with AWS_KEY='AKIAABCDEFGHIJKLMNOP'.`

Show the Privacy Guardian modal before submission. Click **Redact before sending to Gemini**. Confirm that the modal closes immediately and that the request continues using a redacted Gemini-bound copy. Do not show a real credential or a raw token.

**Say:**

> Before Gemini is called, the server scans both new entries and replies for documented secret and PII patterns. This fake AWS-style test fixture triggers Privacy Guardian before the AI request; the application does not connect to AWS. I choose Redact before sending to Gemini. The user's original RAW journal content is preserved according to the application policy, but the Gemini-bound copy is redacted. The modal closes immediately after the decision. The alternative Send as-is anyway decision is explicit and user-controlled, not silently assumed.

**On-screen caption:**

`Detect -> ask the user -> redact or explicitly send -> audit`

**Important narration limit:**

> This is deterministic protection for documented patterns, not a guarantee that every obfuscated or encoded secret will be detected.

### 1:35-1:55 - App Check API Boundary

**On screen:** Open DevTools and select the **Network** tab. Submit a normal safe entry or use a prepared request. Select the `POST /api/entries` request. Show the request headers only far enough to show that `X-Firebase-AppCheck` is present. Hide the token value itself. Show the successful HTTP result.

Next, use DevTools **Copy as fetch** in a separate controlled test. Remove the `X-Firebase-AppCheck` header and run the request. Show HTTP `401`. Repeat with an obviously invalid value and show HTTP `401`.

**Say:**

> Firebase App Check, backed here by a score-based reCAPTCHA Enterprise site key, is the second API boundary. A valid authenticated browser request includes an App Check token, and the server verifies it before the journal route runs. When I remove the header, the request is rejected with 401. An invalid token is also rejected. App Check helps block unauthorized application clients; it does not replace Firebase Auth and it does not make privileged Google Cloud operators untrusted.

**On-screen caption:**

`Valid Auth + valid App Check -> allowed`

`Missing or invalid App Check -> 401`

**Token safety rule:** Never display the complete App Check JWT, Firebase ID token, Authorization header, cookies, or copied fetch command containing credentials.

### 1:55-2:15 - Integrity and Security Activity

**On screen:** Close DevTools or switch back to the application. Click **VERIFY JOURNAL INTEGRITY**. Show the successful `chain intact` result. Open **SECURITY ACTIVITY** and show recent event names such as `entry_created`, `pii_detected`, and `integrity_verified`. Crop the view so no raw journal content is visible.

**Say:**

> The application maintains server-side SHA-256 chains using `hash` and `prevHash`. Integrity verification recalculates the chain instead of trusting the displayed values. The Security Activity panel is read-only for the user and exposes security-relevant events without allowing client-side audit writes or deletion.

### 2:15-2:35 - Individual and Delete-All Lifecycle

**On screen:** Delete Entry A using its individual delete control. Confirm the deletion. Show that the entry disappears from the feed and its calendar marker disappears. If a second entry remains, open the **DELETE DATA** flow and show the confirmation modal. Confirm **Remove All Entries**. Show the empty journal and the calendar with no deleted-entry marker.

**Say:**

> Individual deletion removes one entry from the visible journal and calendar immediately. Delete All applies the same policy to the complete visible journal. The user experience is cleared, but the audit trail is intentionally preserved. Protected retention records remain outside the client-readable journal paths so a later server-side worker can apply the 30-day redaction policy.

**On-screen caption:**

`Visible journal removed immediately`

`Audit preserved`

`Retention records backend-only`

### 2:35-2:50 - Retention and Secret Manager

**On screen:** Show a sanitized architecture or deployment evidence screen, not raw Firestore journal content. If showing retention evidence, show only a controlled fixture's status or the `entry_redacted` audit event. Do not show readable deleted content, secret values, or a raw document containing personal notes.

**Say:**

> The daily retention scheduler processes due records through a protected internal endpoint. After the retention period, readable journal and conversation content is replaced by `Deleted`, while minimal chain metadata and a hashed deletion actor identifier remain. Gemini credentials, the deletion HMAC key, and the retention worker token are injected into Cloud Run from Secret Manager at runtime. They are not placed in the frontend bundle or Docker build arguments.

### 2:50-3:00 - Architecture, OWASP, and Closing

**On screen:** Show `docs/ARCHITECTURE.svg`, then briefly show the feature inventory or OWASP coverage document. If available, show the Cloud Run service label `dev-tutorial=cloud-run-ai-challenge` without showing project secrets.

**Say:**

> The architecture separates Firebase identity, App Check, the Express API, Gemini, Firestore storage paths, Secret Manager, and the retention worker. The OWASP LLM Top 10 coverage documents the implemented controls and their limits, including prompt-injection reduction, sensitive-information interception, output handling, reduced model agency, and bounded consumption.
>
> The accurate version 1 claim is this: journal data is isolated per authenticated user and protected from unauthorized application clients. Privileged Google Cloud operators and the backend runtime remain trusted components. That boundary is intentional, documented, and supported by IAM review, audit logging, and least-privilege deployment identities.

**Final on-screen caption:**

`Personal Gemini Journal`

`Private by user boundary. Protected at the application boundary. Honest about trusted infrastructure.`

## Evidence Capture Rules

- Show presence of `X-Firebase-AppCheck`, never its full value.
- Show HTTP status codes, not authenticated request headers in full.
- Use only the fake `AKIAABCDEFGHIJKLMNOP` sample.
- Never show `GEMINI_API_KEY`, `DELETION_HMAC_KEY`, `RETENTION_WORKER_TOKEN`, Firebase service-account JSON, Firebase ID tokens, App Check JWTs, cookies, or real personal journal content.
- Do not claim the App Check success/rejection test passed until the live browser test is recorded in [TEST_RESULTS.md](TEST_RESULTS.md).
- Do not claim the 30-day transformation passed until a controlled due-record fixture produces the documented `entry_redacted` evidence.
- Do not claim full least privilege until the inherited `roles/editor` concern has been reviewed with Policy Simulator and the final IAM decision is recorded.
- Do not show raw Firestore notes as proof of security. Show the architecture, sanitized metadata, hash fields, audit event names, and test results instead.

## If the Live Demo Fails

Do not improvise a stronger claim. Use one of these safe alternatives:

- If Gemini is slow: cut to the prepared successful recording of the same safe entry and continue with the security evidence.
- If App Check cannot obtain a token: state that the live App Check evidence is pending, show the documented architecture, and do not present the request as verified.
- If Firebase authentication fails: stop the recording, fix the Authorized Domains or provider configuration, and record again. Do not bypass authentication in the production segment.
- If deletion fails: do not manually delete Firestore documents during the demo. Show the last successful deletion recording and record the failure for remediation.
- If the console contains extension noise: use a clean browser profile and record only the relevant Network result.

## Reviewer Follow-Up Package

Provide these artifacts with the video when the submission portal allows links or attachments:

- [README.md](README.md) for the feature inventory, architecture, security claim, deployment state, and boundaries.
- [EVALUATION_DOSSIER.md](EVALUATION_DOSSIER.md) for the evaluator-facing matrix and current evidence status.
- [TEST_RESULTS.md](TEST_RESULTS.md) for the reproducible manual checklist and execution records.
- [OWASP_LLM_TOP10_COVERAGE.md](OWASP_LLM_TOP10_COVERAGE.md) for the LLM-specific control mapping and limitations.
- [ARCHITECTURE.svg](docs/ARCHITECTURE.svg) for the source-controlled architecture image.
- [SELF_DEPLOYMENT_GUIDE.md](SELF_DEPLOYMENT_GUIDE.md) for the actual deployment workflow and operator prerequisites.

The reviewer should receive a safe public URL or walkthrough, a dedicated test account only when required by the submission process, and instructions for testing the application. Never publish credentials in the repository, video description, README, or public screenshots.

## Presenter Checklist

- [ ] The video tells one end-to-end privacy and integrity story.
- [ ] Google Sign-In and per-user UID isolation are shown.
- [ ] Gemini summary, topics, reflection, closed-set category clustering, conversation, related entry, and calendar behavior are shown.
- [ ] Privacy Guardian is shown with the fake AWS-style secret fixture and Redact before sending to Gemini.
- [ ] App Check valid, missing, and invalid-token outcomes are shown only if live evidence is complete.
- [ ] Hash rehash verification and Security Activity are shown.
- [ ] Individual deletion and Delete All are shown.
- [ ] Retention is described accurately as backend-only delayed redaction, not immediate permanent deletion.
- [ ] Secret Manager is described as runtime injection, not as a frontend secret store.
- [ ] OWASP coverage is shown as implemented controls plus stated limitations.
- [ ] The trusted operator/runtime boundary is stated explicitly.
- [ ] No real secrets, tokens, cookies, personal notes, or private account details appear.
