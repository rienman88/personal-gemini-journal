# Personal Gemini Journal: How It Works

## What this is

Personal Gemini Journal is a private, Google-authenticated journal that responds to entries with a short summary, broad categories, and a reflection question. Each entry can continue as its own multi-turn conversation.

The full evaluator-facing inventory is in [EVALUATION_DOSSIER.md](EVALUATION_DOSSIER.md); this document focuses on the user experience, data behavior, and failure behavior.

The application separates the user's original words from Gemini's interpretation. User text is stored as RAW content. Gemini's summary, topics, categories, and replies are DERIVED content and are labeled accordingly in the interface.

## The user flow

1. **Sign in with Google.** Firebase Authentication handles identity; the application does not create or store passwords. The browser session uses Firebase's local persistence until the user signs out or Firebase invalidates the session.
2. **Open the private dashboard.** Firebase Auth state determines whether the composer, feed, calendar, related entries, security activity, and deletion controls render. The API also accepts a Firebase App Check token in production.
3. **Write an entry.** The browser shows a local preview of possible sensitive content in AI Journal mode, but the server performs the trusted scan. AI entries are limited to 3,000 characters and Private Journal entries to 4,000 characters. Each request uses a client request ID to prevent duplicate saves.
4. **Review Privacy Guardian findings.** If the server detects a likely secret or PII, the user chooses Redact or Send as-is. The modal closes as soon as the choice is made. The original text remains unchanged in the saved RAW record; only the copy sent to Gemini is redacted when Redact is selected.
5. **Receive Gemini analysis.** The server asks Gemini for a short summary, up to five topics, one or two fixed categories, and a reflection question. If Gemini is unavailable or returns unusable output, the entry is still saved without derived analysis.
6. **Continue the entry.** AI replies are limited to 1,500 characters, sent through the same Privacy Guardian and fallback pipeline, and produce a Gemini reply limited to 1,000 characters. Private Journal uses **Add Private Note** instead: the note is limited to 1,000 characters, stored as a user-authored hash-chained turn, and never sent to Gemini. The full thread remains available to the owner, while only the latest ten turns are sent to Gemini for AI replies.
7. **Browse and connect the journal.** Firestore provides realtime owner-scoped reads. The category graph shows related entries sharing one of eight fixed categories. The calendar is computed from the same entry snapshot, shows date counts, and jumps to the first entry for a selected day.
8. **Inspect security activity.** The signed-in user can view recent security events such as PII detection, rate limiting, entry creation, deletion, redaction, replies, and integrity checks. Audit events do not contain journal text or secrets.
9. **Verify integrity or manage deletion.** Integrity verification checks the entry chain and each active conversation chain, while treating deleted entries as chain-preserving tombstones. The result separates total server records checked, entries awaiting retention redaction, and entries still visible in the journal. Removing one entry or the whole journal hides entries and calendar markers immediately; audit events remain, and protected records are retained for up to 30 days before privacy redaction.

## Example scenarios

### AI Journal or Private Journal

The dashboard includes a per-user journal mode switch. **AI Journal** keeps the normal Gemini experience: Privacy Guardian, structured summaries, topics, categories, reflections, and replies. **Private Journal** saves the user's RAW entry with its hash, audit metadata, calendar date, and normal deletion lifecycle. It does not call Gemini, spend Gemini tokens, or create derived insight, but it does allow clearly labeled user-authored private notes. The selected mode is stored on the preference document and stamped on each entry, so changing the switch never rewrites older entries.

**A normal reflection.** You write about an exhausting workday. Gemini returns a concise summary, categorizes it as `work`, and asks a follow-up question. Your reply stays inside that entry's conversation.

**A sensitive value in a reply.** You paste a string that resembles an AWS key into the fifth reply of a conversation. Privacy Guardian runs again on that reply, offers the same two choices, and records the detection without changing the RAW text stored in Firestore.

**A Gemini outage.** The server tries the configured model ladder and bounded retries. If every attempt fails, the user's entry or reply is still persisted. The UI reports that derived analysis was unavailable instead of losing the user's words.

**Deleting an entry.** The entry, its conversation turns, and its calendar marker disappear immediately. The server first moves the full record to backend-only retention storage, then leaves a minimal tombstone in the active hash chain. After 30 days, the retention worker replaces retained journal and conversation text with `Deleted`, removes sensitive derived metadata, and keeps only minimal deletion, timestamp, and hash metadata. The audit record remains because it is a security record, not journal content.

**Choosing Private Journal.** A user can save a sensitive or ordinary thought without sending it to Gemini. This is a processing choice, not a claim that the trusted Cloud Run backend or privileged Google Cloud operators cannot access Firestore data.

## Security boundaries

- Firebase ID tokens are verified by the Express server. The server derives the user ID from the verified token, never from a request body field.
- Firebase App Check is a second, independent signal for the public custom API. The browser obtains a score-based reCAPTCHA Enterprise token and sends it as `X-Firebase-AppCheck`; production rejects missing or invalid tokens when `ENFORCE_APP_CHECK=true`. App Check does not replace Firebase Auth and does not identify the user.
- Firestore rules allow reads only within `users/{uid}/...` for the matching authenticated owner and deny client writes.
- The Admin SDK performs server-side writes for entries, conversations, metadata, usage counters, audits, and protected retention records. The browser cannot read or write retention collections.
- Gemini output is display-only. It cannot authorize a request, execute a tool, or write to Firestore directly.
- Private Journal is enforced before Gemini and token-budget work on the server. The browser switch is a usability control; the server-side preference and per-entry mode are the authority.
- The Gemini key is a server-side runtime secret in production and is never bundled into the frontend.
- Entries and conversation turns are hash-chained so later modifications are detectable through the integrity endpoint.
- Deleted entries preserve `prevHash` and `hash` as tombstones so deletion does not break verification of later entries. Replies to a deleting or deleted entry return `410` and do not create new turns.
- App Check is independent of Firebase Auth: it helps reject scripted use of the public custom API but does not identify the user or replace the verified ID token.

## Limitations

- Privacy Guardian is deterministic pattern matching, not a guarantee that every secret or obfuscated value will be found.
- Category-based related entries are intentionally simpler than semantic search. The graph uses a fixed set of eight categories.
- Gemini context is bounded to ten recent turns; very old turns remain stored and visible but are not included in each new model request.
- The local emulator suite does not prove production Cloud Run latency, IAM propagation, quotas, or real Gemini availability.
- The 30-day redaction is not a Firestore TTL delete. A daily Cloud Scheduler request must be configured for `POST /internal/retention/redact`; until then, due records remain in protected retention storage.
- App Check enforcement depends on production Firebase Console registration and a build-time reCAPTCHA Enterprise site key. Emulator development intentionally leaves App Check disabled.
- The Cloud Run provisioning script is repeatable, and staging IAM/revision/scheduler checks are recorded; it cannot prove final Firebase Console configuration, production IAM propagation, or every production user flow from this workspace.
- Firebase Auth persistence is intentionally local for a trusted personal computer. Sign out manually on shared or public devices; this version does not add a custom session cookie or automatic idle logout.
- The free Gemini tier may have different data-use terms from a paid project. Confirm the active provider terms before using sensitive real-world content.

## Failure behavior

- **Missing or invalid authentication:** the API returns `401`; no user data is accessed.
- **Missing or invalid app verification:** when production enforcement is enabled, the API returns `401` before the journal handler runs; the browser reports a recoverable refresh message.
- **Sensitive content detected:** the request pauses for an explicit choice; content is not silently sent to Gemini.
- **Too many requests or tokens:** the API returns a clear `429` response and records a rate-limit event for the authenticated user.
- **Malformed Gemini output:** structured analysis retries within the model, then falls back to the next model.
- **Gemini unavailable:** the RAW entry or user reply is persisted with a clear `geminiOk: false` result.
- **Save failure:** the UI keeps the typed content available for retry and does not claim the record was saved.
- **Deletion failure:** the confirmation modal remains open with an actionable error. On success, the entry is removed from the feed and calendar without waiting for a second user action.
- **App Check token failure:** the client does not send the API request and reports a recoverable refresh message. If a missing or invalid token reaches an enforced server, the server returns `401` before journal processing.
