# OWASP Top 10 for LLM Applications - Actual Coverage

Every control below was checked against the implementation in this repository. Manual execution instructions are in [TEST_RESULTS.md](TEST_RESULTS.md), steps 17-61. A manual ID is an executable check, not a claim that the check has already passed. The verification status in TEST_RESULTS distinguishes existing evidence from operator-only or final-production work.

This document covers the LLM-specific layer. The broader application controls are documented in [EVALUATION_DOSSIER.md](EVALUATION_DOSSIER.md), including Firebase Auth, Firebase App Check, Firestore rules, hash chains, audit events, deletion retention, Cloud Run IAM, Secret Manager, and Scheduler.

## LLM01: Prompt Injection - partially mitigated, not solved

- User content is wrapped in explicit journal-entry data boundaries with instructions to treat the content as data, never as a command.
- Multi-turn replies are sent as separate conversation messages rather than concatenated into one untyped instruction blob.
- Gemini output is display-only DERIVED data. It never determines authorization, triggers a code path, calls a tool, or writes Firestore.
- Schema validation rejects categories outside the fixed eight-value list.
- Manual verification: Step 31 tests instruction-like journal content and confirms that it cannot produce an application action.
- Honest limit: no prompt-level defense is complete. This reduces the attack surface; it does not eliminate prompt injection.

## LLM02: Sensitive Information Disclosure - real coverage with stated limits

- Privacy Guardian runs before every Gemini call, on initial entries and every conversation reply.
- Deterministic patterns cover AWS keys, Google API keys, generic secret assignments, email addresses, phone numbers, and US SSNs.
- The user chooses whether the Gemini-bound copy is redacted or explicitly sent as-is. The saved RAW content is not changed.
- Manual verification: Steps 25 through 28 cover both user decisions on entries and replies; Step 58 verifies Grammarly does not alter the saved text.
- Manual verification: Step 29 checks that an AI failure does not discard or expose the RAW content.
- Honest limit: Base64, homoglyph, obfuscated, encoded, and novel secrets can evade deterministic patterns. This is an explicit boundary, not a completed defense claim.

Private Journal is an additional user-controlled disclosure boundary: when the authenticated preference is `private`, the server does not call Gemini, does not run the Gemini-bound Privacy Guardian decision path, and does not create a conversation. This reduces disclosure risk by avoiding model transmission altogether, but it does not replace authentication, App Check, Firestore isolation, or the trusted-runtime boundary.

## LLM03: Supply Chain - addressed by deployment practice

- Dependencies are mainstream and intentionally minimal: Express, CORS, Firebase Admin, Google GenAI, React, and their required transitive packages.
- The Docker build is multi-stage and the runtime image does not receive server secrets as build arguments.
- Cloud Build and Cloud Run identities are separate; image write access is repository-scoped.
- Manual verification: Step 55 checks a clean Docker build and scans the image/build boundary for .env files, key files, and credentials. Step 56 checks identity and repository scope.
- Ongoing requirement: review dependency updates and rebuild from a clean checkout before releases. No additional runtime feature is required for this category.

## LLM04: Data and Model Poisoning - not applicable to this architecture

- The application does not train, fine-tune, or update a model. It calls Gemini's hosted API for inference and stores user-scoped results.
- Manual architecture check: inspect the repository and deployment pipeline for training data ingestion, fine-tuning jobs, model artifact uploads, or feedback-to-training paths. None are present.
- N/A is intentional; forcing a training-poisoning control onto an inference-only system would create documentation noise rather than security value.

## LLM05: Improper Output Handling - real coverage

- React JSX rendering escapes dynamic values; dangerouslySetInnerHTML is not used.
- Gemini structured output is schema-validated before it is persisted.
- AI content is visibly labeled DERIVED and is not treated as an instruction or authority.
- Manual verification: Step 30 tests malformed/failed model behavior; Step 34 verifies RAW/DERIVED separation; Step 57 checks visible labels, dialog semantics, and safe rendering through the user interface.

## LLM06: Excessive Agency - strongly reduced by design

- Gemini has no tool-calling or function-declaration configuration.
- Gemini cannot authorize a request, write Firestore, delete records, call an external service, or change server state.
- All writes and deletion decisions are controlled by authenticated, deterministic Express routes.
- Manual verification: Step 31 attempts an action-oriented prompt; Step 32 checks that model replies remain inside the selected conversation; Step 50 verifies App Check is an access boundary rather than a model authority boundary.
- The architecture intentionally accepts no model agency, which is stronger than attempting to sandbox many model tools.

## LLM07: System Prompt Leakage - mitigated by minimal prompt sensitivity

- Prompts contain no server secrets, other users' data, service-account credentials, or infrastructure tokens.
- Server-only credentials are injected at runtime from Secret Manager and never enter the prompt or frontend bundle.
- Manual verification: Step 31 asks for instructions/secrets and confirms that the output remains non-authoritative journal text; Step 55 checks that secrets are absent from image/build inputs.
- Honest limit: no string filter can guarantee that a model will not discuss a prompt. The safer design is ensuring there is no sensitive system secret behind the prompt boundary.

## LLM08: Vector and Embedding Weaknesses - not applicable

- There is no vector search, embedding generation, retrieval-augmented generation, or similarity index.
- Related entries use a fixed category graph over the already loaded owner-scoped entries, not semantic retrieval.
- Manual architecture check: inspect source, routes, dependencies, and deployment configuration for embeddings, vector databases, RAG context injection, or cross-user retrieval. None are present.
- Manual verification of the non-RAG boundary is included in Steps 33 and 34.

## LLM09: Misinformation - mitigated by RAW/DERIVED separation

- User text remains RAW and Gemini summary, topics, categories, reflection, and model turns are labeled DERIVED.
- The UI does not present Gemini output as a verified fact or as an authorization decision.
- Manual verification: Step 34 compares exact user text with AI-derived values and Step 31 checks that an instruction-like claim cannot perform an action.
- This is a presentation and trust-boundary mitigation, not a factuality guarantee from Gemini.

## LLM10: Unbounded Consumption - multiple independent layers

- Per-user request rate limit: eight requests per minute with a 429 response after the limit.
- Per-user daily token budget: 50,000 tokens, including retries and failed model attempts.
- Firebase App Check can reject scripted requests before the journal handler when enforcement is enabled; it is a secondary abuse signal, not a replacement for Firebase Auth.
- The per-user AI Journal / Private Journal choice is enforced server-side. Private Journal avoids Gemini processing and token usage, while still using authenticated storage and request-rate controls.
- Output tokens are bounded to 512 for analysis and 384 for replies.
- Inputs are capped at 8,000 characters for entries and 2,000 characters for replies.
- Conversation context is capped at the latest ten turns.
- Manual verification: Step 36 tests the request limiter; Step 37 tests the daily token budget; Step 50 tests final App Check enforcement; Step 54 checks the bounded scheduled worker batch.

## OWASP manual verification cross-reference

| Step | Test action | Execution output / expected result | Verification |
| --- | --- | --- | --- |
| Steps 25-28 | Privacy Guardian decisions on entry and reply | Redact and Send as-is each require the correct user decision, preserve RAW content, and unmount the modal immediately. | **PASSED for interception/modal smoke; live storage checks READY TO RUN** |
| Steps 29-31 | Gemini failure, bounded fallback, and prompt-injection content | AI failures remain safe and bounded; instruction-like content is data only and cannot cause application actions. | **Automated resilience PASSED; live controlled checks READY TO RUN** |
| Step 34 | RAW/DERIVED and output handling | User text remains distinct from escaped, labeled Gemini-derived values. | **READY TO RUN - OPERATOR** |
| Steps 36-37 | Rate and token consumption controls | Excess request or budget usage returns 429 and records the security event without continuing to Gemini. | **READY TO RUN - CONTROLLED ACCOUNT** |
| Step 39 | Integrity and tamper response | A controlled hash mutation is detected and recorded; no production data is mutated for the test. | **READY TO RUN - ISOLATED TEST DATA** |
| Steps 46-49 | Retention, deleted-data isolation, and direct-client rules | Deleted content is hidden, retention collections are backend-only, due material becomes Deleted, and direct client access is denied. | **Unit/emulator PASSED; due-record staging evidence READY TO RUN** |
| Step 50 | App Check enforcement | Deployed revision rejects missing/invalid App Check with 401 and accepts valid Auth plus App Check. | **Cloud Run enforcement deployed; live browser token test READY TO RUN** |
| Steps 55-56 | Docker, secrets, identities, and image supply chain | Image/build input contains no server secret; build and runtime access are separated and least-privilege bindings are present. | **PASSED by deployment/code review; clean-machine recheck READY TO RUN** |
| Step 60 | Release rollback | Traffic can return to a known-good immutable revision without deleting data, rules, or secrets. | **READY TO RUN - OPERATOR** |
| Step 61 | AI Journal / Private Journal policy | Private Journal persists RAW text and security metadata without Gemini, derived output, token usage, or conversation creation; AI Journal preserves the existing guarded path. | **Policy tests and browser smoke PASSED; live preference persistence READY TO RUN** |

## What this means for the submission

Six categories have real code-level LLM coverage: LLM01, LLM02, LLM05, LLM06, LLM09, and LLM10. LLM03 is addressed by dependency and build discipline. LLM04 and LLM08 do not apply to this inference-only, non-RAG architecture. LLM01 remains partial by design. Claiming more than this would overstate what any LLM prompt defense can guarantee.

## Cross-cutting application controls outside the LLM list

- Firebase Auth verifies the bearer ID token and supplies the only trusted user identity; client-supplied UID fields are not accepted.
- Firebase Auth is explicitly configured for browser-local persistence to support trusted-device usability. This is not a server session or custom application cookie; explicit Sign out remains the control for shared/public devices, and Firebase still controls token refresh and invalidation.
- Firebase App Check uses a score-based reCAPTCHA Enterprise provider in the browser and Admin SDK token verification on the custom Express API when production enforcement is enabled.
- Firestore rules allow owner reads only, deny all client writes, hide conversations for deleted/deleting entries, deny retention collections, and default-deny unknown paths.
- Privacy Guardian scans both entries and replies for the documented secret and PII patterns before Gemini calls.
- RAW content is hash-chained and distinct from DERIVED Gemini output; the integrity endpoint validates active entries, conversations, and chain-preserving deletion tombstones.
- Audit records are owner-readable metadata only and intentionally remain after journal deletion.
- Individual and all-journal deletion moves full records to backend-only retention storage, keeps a hashed deletion actor identifier, and redacts readable journal material after 30 days through a protected scheduled worker.
- Cloud Run deployment automation uses separate user-managed build and runtime identities. The runtime has only datastore and named Secret Manager access, and the build identity has repository-scoped image-push access without runtime secret access.

## Current verification boundary

Cloud Run behavior is verified for the shell, health endpoint, both current hostnames, worker authorization, valid empty-batch worker execution, Scheduler HTTP 200, dedicated runtime identity, immutable image, required cohort label, Secret Manager references, `ENFORCE_APP_CHECK=true`, and the retention index reaching READY.

The remaining release evidence is explicit and operator-controlled: Firebase Google-provider and Authorized-Domain confirmation, Firebase App Check Web-app registration confirmation, authenticated browser success with a valid App Check token, missing/invalid-token rejection, a controlled due-record transformation producing `entry_redacted`, final IAM/billing review, and Academy submission artifacts. These are not hidden application defects and must not be represented as passed until the operator records them in `TEST_RESULTS.md`.
