# Usability checklist — manual, not automated

USABILITY pillar. Usability isn't something a unit test can honestly certify, so this is a walkthrough instead of a fake automated suite.

Use [EVALUATION_DOSSIER.md](EVALUATION_DOSSIER.md) for the full implementation inventory. This checklist records which user-facing paths are covered by smoke tests and which need a human walkthrough against a deployed service.

## Latest operator confirmation - 2026-09-04

- [x] User-reported manual review confirms the current user-facing features and UI paths operate as designed.
- [x] Automated browser smoke suite passes 6 tests: Privacy Guardian both decisions, individual deletion, integrity-count display, Calendar v1 responsive behavior including collapsed-card expansion, AI Journal / Private Journal mode behavior, and accordion scrolling.
- [ ] External production gates remain separately tracked: Firebase Console registration confirmation, live App Check valid/missing/invalid-token evidence, controlled `entry_redacted` evidence, and final IAM review.

- [x] Every input has a visible label (not just a placeholder) - user-verified 2026-09-04
- [x] Tab through the whole flow - entry, reply, sign-in - using only the keyboard; focus is always visible - user-verified 2026-09-04
- [x] Error messages say what happened and what to do next, not a stack trace - user-verified 2026-09-04
- [x] The Privacy Guardian modal explains why it appeared and what each button does, in one glance - user-verified 2026-09-04
- [x] Saving an entry or sending a reply gives feedback within ~1s even before Gemini responds - user-verified 2026-09-04
- [x] The app is usable at a phone width (375px) without horizontal scroll - user-verified 2026-09-04
- [x] Signing out and back in returns you to your own entries only - user-verified 2026-09-04
- [x] On a trusted personal computer, browser-local Firebase Auth persistence survives reload; on a shared/public computer, explicit Sign out removes the local session - user-verified 2026-09-04
- [x] An empty journal shows a next-step message, not a blank page - user-verified 2026-09-04
- [x] RAW entry text and the DERIVED summary are visually distinct at a glance - user-verified 2026-09-04
- [x] Category pills and related entries do not overwhelm the entry itself - user-verified 2026-09-04
- [x] The conversation thread is clearly scoped to one entry, not a separate global chat - user-verified 2026-09-04

## Complete feature walkthrough

- [x] Google Sign-In popup succeeds, and redirect fallback works when a popup is blocked - user-verified 2026-09-04
- [x] Sign-out and sign-in again preserve the user's own journal state and do not expose another user's data - user-verified 2026-09-04
- [x] Auth persistence behavior is clear to the operator: no custom application cookie or automatic idle logout is used, so shared/public devices require manual Sign out - user-verified 2026-09-04
- [x] Entry composer saves ordinary text and shows summary, topics, categories, reflection, timestamp, and integrity shortcode - user-verified 2026-09-04
- [x] Entry input rejects or bounds oversized content without losing the user's draft - user-verified 2026-09-04
- [x] Privacy Guardian detects a sensitive entry and offers Redact, Send as-is, and Cancel - user-verified 2026-09-04
- [x] Privacy Guardian closes immediately after either decision and preserves an actionable error if saving fails - user-verified 2026-09-04
- [x] A reply stays visually scoped to its parent entry and uses the same Privacy Guardian behavior - user-verified 2026-09-04
- [x] Gemini failure visibly reports unavailable derived analysis while keeping the user's RAW text - user-verified 2026-09-04
- [x] Related entries appear only when entries share a fixed category - user-verified 2026-09-04
- [x] Calendar marks entry dates, shows multiple-entry counts, navigates months, supports Today, and jumps to the first matching entry - user-verified 2026-09-04
- [x] Security Activity shows metadata-only events and no journal text or secret values - user-verified 2026-09-04
- [x] Integrity verification reports the entry/conversation chain result and does not expose deleted content - user-verified 2026-09-04
- [x] Individual deletion removes the entry from the feed and calendar after server confirmation - user-verified 2026-09-04
- [x] All-journal deletion removes entries and calendar markers while the audit trail remains - user-verified 2026-09-04
- [x] Retained/deleted entries are not visible in the journal UI - user-verified 2026-09-04; browser-read denial remains an external security test
- [x] AI Journal / Private Journal toggle is visible, accessible, and server-backed; Private Journal visibly explains that Gemini is not used - browser smoke verified 2026-09-05
- [x] AI Journal exposes a 3,000-character entry and 1,500-character user-reply limit; Private Journal exposes a 4,000-character entry and 1,000-character private-note limit - browser smoke verified 2026-09-05
- [x] Private Journal labels user-authored notes separately from Gemini replies and does not create a model response - browser smoke verified 2026-09-05
- [x] Journal cards can collapse and expand with accessible arrow controls; long expanded bodies use a bounded scrollbar - browser smoke verified 2026-09-05
- [ ] Production App Check allows the normal browser flow and rejects a missing/invalid app token

## AI processing choice - 2026-09-05

- [x] The mode control starts in AI Journal for backward compatibility and exposes an explicit Private Journal option.
- [x] Private Journal saves without opening Privacy Guardian, requesting Gemini, creating a model turn, or showing derived AI output in the smoke fixture; its private-note control is clearly labeled.
- [x] The server policy tests prove the browser choice is not trusted by itself: the authenticated preference is read and enforced by Express.
- [ ] Manually verify preference persistence across sign-out/sign-in and verify a live private entry has `journalMode=private` and `aiUsed=false`; before a note there is no conversation document, and after a note only user-authored turns exist.

## Modal polish pass — 2026-09-02

- [x] Privacy Guardian closes immediately after Redact or Send as-is is selected for entries and replies
- [x] Delete Data closes on Cancel or after the server confirms removal; it remains visible during an in-flight destructive request so failures remain actionable
- [x] Browser smoke test asserts both Privacy Guardian decisions unmount immediately while the request is still pending

## Calendar v1 — 2026-09-03

- [x] Calendar derives marked dates from the existing realtime entry snapshot
- [x] Selecting a marked date navigates to the first matching journal entry
- [x] Empty dates are not interactive, and multiple entries show a count
- [x] Calendar stacks above the feed on narrow screens without adding a second calendar data or deletion path

## Server test-harness repair — 2026-09-03

- [x] Firestore rules test resolves the root-level rules file after TypeScript compilation
- [x] Firestore emulator cleanup cannot create a secondary failure when setup fails
- [x] Fallback-attempt assertion matches the six-model ladder and three attempts per model
- [x] Emulator-backed server suite passes: 44 passing, 2 intentionally pending

## Calendar runtime error triage — 2026-09-03

- [x] Confirmed `JournalCalendar.tsx` imports `useState`; no runtime path change was necessary
- [x] Production build and browser smoke test pass with the current calendar implementation
- [x] Stale Vite/HMR recovery documented: stop and restart the Vite dev server, then hard-refresh the browser

## Privacy-safe deletion lifecycle - 2026-09-03

- [x] Individual entry removal uses a custom confirmation modal, not native `confirm()`
- [x] Individual removal closes only after the server confirms success; failures remain actionable
- [x] Successful individual removal removes the entry from the feed and derived calendar in the same render
- [x] All-journal removal uses the same retention semantics and keeps the audit trail
- [x] Deleted and deleting states are filtered from the journal UI and calendar
- [ ] Manually verify the active tombstone and 30-day redaction behavior against a deployed Firestore project
- [x] Configure and invoke the daily Cloud Scheduler retention worker in staging; the valid empty-batch path returns HTTP 200
- [ ] Observe a due-record production or controlled-staging run that produces `entry_redacted`

## Production hardening verification - 2026-09-03

- [x] App Check client token attachment and server middleware are implemented without changing emulator behavior
- [x] Dedicated Cloud Run service-account and retention-scheduler provisioning is scripted
- [ ] Register the production reCAPTCHA Enterprise key in Firebase App Check
- [ ] Verify normal deployed browser requests pass App Check and missing/invalid tokens receive `401`
- [x] Verify the Cloud Run revision uses the dedicated runtime service account and the separate build identity performed the image build/push; review documented IAM scope before final release
- [ ] Observe one scheduled retention run and its `entry_redacted` audit event

## Evaluator boundaries

- Local smoke tests use API mocks for UI timing and do not prove Gemini, Firebase Auth, final App Check enforcement, or every Cloud Run production user flow.
- App Check is deliberately disabled in emulator mode; production verification requires Firebase Console registration and a build-time reCAPTCHA Enterprise site key.
- The retention scheduler is provisioned by `scripts/provision-cloud-run.ps1`; its staging empty-batch invocation is verified, but a controlled due-record 30-day transition must still be observed in Google Cloud.
