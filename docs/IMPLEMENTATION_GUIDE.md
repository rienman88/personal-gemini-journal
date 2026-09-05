# Implementation Guide

This guide maps the [Google Cloud Gen AI Academy APAC Edition, Cohort 3](https://hack2skill.com/event/apac-genaiacademy?tab=cohort3&utm_source=hack2skill&utm_medium=homepage) ideathon requirements to this repository. The application code is hand-written and locally verified; the Google AI Studio, Firebase Console, Google Cloud, Cloud Run, GitHub/GitLab, social post, and Academy dashboard steps remain external actions.

Use [SETUP_DOCUMENT_MAP.md](SETUP_DOCUMENT_MAP.md) for the recommended order of the AI Studio, Docker, Firebase, Cloud Run, verification, publication, and submission documents.

For an evaluator-facing description of every implemented feature and its evidence, use [EVALUATION_DOSSIER.md](EVALUATION_DOSSIER.md).

## Operating recommendation

The repository now includes the production hardening path for the three material gaps: a dedicated Cloud Run service account, a daily retention scheduler, and Firebase App Check on the custom API. Run that path after the external Firebase and Google Cloud prerequisites are ready, then complete the live verification checklist.

The repository's supported deployment path is Docker -> Cloud Build -> Artifact Registry -> Cloud Run. Use [DOCKER_DEPLOYMENT_RUNBOOK.md](DOCKER_DEPLOYMENT_RUNBOOK.md) for the container procedure and [CLOUD_IMPLEMENTATION_RUNBOOK.md](CLOUD_IMPLEMENTATION_RUNBOOK.md) for the reusable cloud configuration, verification, rollback, and safe operator record template. The public-safe document order is in [SETUP_DOCUMENT_MAP.md](SETUP_DOCUMENT_MAP.md).

## 1. Requirements and current implementation

The repository currently provides:

- Firebase Google Sign-In without application-managed passwords.
- Multi-turn Gemini conversations scoped to individual journal entries.
- User-isolated Firestore reads and backend-only writes.
- Production Secret Manager injection through `GEMINI_API_KEY`.
- Privacy Guardian scanning on entries and replies.
- RAW/DERIVED separation, hash-chain integrity verification, and security audit events.
- Calendar v1 derived from the existing realtime entry snapshot.
- Privacy-safe individual and all-journal deletion: immediate UI/calendar hiding, backend-only 30-day retention, chain-preserving tombstones, and delayed redaction.
- Firebase App Check in the browser, with Admin SDK verification on every authenticated API request in the production-enforced deployment; it is disabled only for emulator development or an explicitly labeled staging bootstrap.
- A repeatable provisioning script for the dedicated Cloud Run service account, least-privilege IAM, App Check configuration, Secret Manager bindings, challenge label, and retention scheduler.
- Google Sign-In popup/redirect authentication, explicit Firebase browser-local persistence for trusted-device sessions, sign-out, owner-scoped realtime journal reads, and server-only writes. This uses no custom application session cookie; shared or public devices must be signed out manually.
- User-controlled AI Journal / Private Journal mode persisted under the authenticated user's preferences. Private Journal preserves RAW content, hashes, audit metadata, deletion, retention, and calendar behavior while skipping Gemini, token usage, derived fields, and replies.
- Entry and reply idempotency, input limits, rate limiting, daily token budgets, and clear failure recovery.
- Structured Gemini analysis, six-model fallback, three bounded schema attempts per model (18 maximum structured attempts), multi-turn context limits, RAW/DERIVED labeling, and model-outage persistence.
- Deterministic Privacy Guardian detection for AWS keys, Google API keys, generic secrets, email, phone, and US SSN patterns on both entries and replies.
- SHA-256 entry/conversation hash chains, integrity verification, metadata-only security activity, fixed category relationships, and a derived calendar.
- Individual and all-journal privacy-safe deletion with immediate UI hiding, backend-only retention, chain tombstones, HMAC actor identifiers, and delayed redaction.

The current Gemini client uses this six-model ladder:

```text
gemini-3.6-flash
gemini-3.5-flash
gemini-3.5-flash-lite
gemini-3.1-flash-lite
gemini-flash-latest
gemini-3.7-flash
```

Structured entry analysis gets one initial attempt plus two schema retries per model. Plain conversation replies get one attempt per model. All failures are bounded; a Gemini failure does not prevent the RAW user content from being saved.

## 2. Google AI Studio configuration

1. Open Google AI Studio Build mode and create or select the application used for this project.
2. Open the System Instructions or Custom Instructions area.
3. Paste the complete contents of `CONSTITUTION.md`.
4. Preserve the instruction that user content is untrusted data and that Gemini output cannot control authorization, persistence, or tool execution.
5. Keep the current project architecture when asking AI Studio for suggestions. Do not replace the Express, Firebase Admin, Firestore rules, or Privacy Guardian boundaries without a separate security review.

This repository contains the instruction artifact, but local files cannot prove that it was actually configured in Google AI Studio. Record that step as complete only after checking the AI Studio project directly.

## 3. Firebase and Google Cloud prerequisites

Complete these in the selected Google Cloud/Firebase project:

- [ ] Billing or an eligible trial/credit arrangement is active for the project.
- [ ] Firebase Authentication is enabled.
- [ ] Google is enabled as the sign-in provider and a support email is configured.
- [ ] Firebase terms are accepted when prompted.
- [ ] Cloud Firestore rules are deployed in the target project; the `retentionEntries.redactAt` collection-group index is deployed and `READY`.
- [ ] A Gemini API key is available through Secret Manager for server-side use.
- [ ] `gcloud` and Firebase CLI are installed and authenticated for the target project.
- [ ] A budget alert is configured before real traffic is sent.
- [ ] A score-based reCAPTCHA Enterprise Web key is created for the production Cloud Run hostname and registered in Firebase App Check. Do not add localhost to this production key.

Do not place the Gemini key in `web/.env.local`, source control, frontend code, or a Docker build argument. Production uses Secret Manager. Local development may use an uncommitted environment variable.

## 4. Local verification

Install dependencies from the repository root:

```powershell
npm run install:all
Copy-Item web/.env.example web/.env.local
```

Fill in the Firebase web configuration and keep `VITE_USE_EMULATORS=true` for emulator testing. Start the emulators:

```powershell
firebase emulators:start
```

Start the API in another PowerShell terminal:

```powershell
npm run build --prefix server
$env:GEMINI_API_KEY = "your-local-key"
$env:DELETION_HMAC_KEY = "local-development-only"
$env:RETENTION_WORKER_TOKEN = "local-worker-token"
$env:ALLOWED_ORIGINS = "http://localhost:5173"
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099"
node server/lib/src/index.js
```

Start the frontend in a third terminal:

```powershell
npm run dev --prefix web
```

Run automated verification from the repository root:

```powershell
npm run build
npm run test:smoke
npx --yes firebase-tools@latest emulators:exec --only firestore,auth "npm test --prefix server"
```

Current recorded result: the build passes, the browser smoke suite has 5 passing tests, and the emulator-backed server suite has 38 passing and 2 intentionally pending tests. The pending tests are the live Gemini authenticity check without `GEMINI_API_KEY_TEST` and the named route-level idempotency specification awaiting a complete route harness. AI mode policy tests additionally verify the server-enforced Private Journal no-Gemini branch.

The original manual system verification record in [TEST_RESULTS.md](TEST_RESULTS.md) contains 9 of 9 passed checks covering entry creation, multi-turn replies, authentication persistence, Privacy Guardian on entries and replies, integrity verification, audit activity, category clustering, and raw Firestore inspection. The same file now contains the expanded feature-by-feature manual matrix for deletion, retention, App Check, deployment, accessibility, recovery, and AI mode. The automated evidence also covers deletion lifecycle logic, App Check middleware, Firestore isolation, modal behavior, Calendar v1, and the server-enforced AI/private policy. This is application evidence; it does not replace final production checks below.

## 5. Docker and Cloud Run deployment

The executable Docker procedure is maintained in [DOCKER_DEPLOYMENT_RUNBOOK.md](DOCKER_DEPLOYMENT_RUNBOOK.md), and the reusable Google Cloud configuration and verification workflow is maintained in [CLOUD_IMPLEMENTATION_RUNBOOK.md](CLOUD_IMPLEMENTATION_RUNBOOK.md). The root `Dockerfile` builds the Vite frontend and TypeScript server into one lean Node.js runtime image. `cloudbuild.yaml` supplies only public Firebase/App Check build values, pushes an immutable-tagged image to Artifact Registry, and the provisioning script deploys that image.

The provisioning script creates separate `personal-gemini-journal-build` and `personal-gemini-journal-run` service accounts. The build identity can build and push the image, and the provisioning path does not grant it runtime secret access. The runtime identity can access Firestore and the three named Secret Manager values but has no image-build role. Inspect inherited IAM if either account already existed.

Set the six `VITE_FIREBASE_*` values and the production `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` in the deployment session. These are browser configuration values, not Gemini or lifecycle secrets. Set `RETENTION_WORKER_TOKEN` from a protected file; never place it in a Docker build argument.

```powershell
$env:VITE_FIREBASE_API_KEY = "YOUR_FIREBASE_WEB_API_KEY"
$env:VITE_FIREBASE_AUTH_DOMAIN = "YOUR_PROJECT.firebaseapp.com"
$env:VITE_FIREBASE_PROJECT_ID = "YOUR_PROJECT_ID"
$env:VITE_FIREBASE_STORAGE_BUCKET = "YOUR_PROJECT.firebasestorage.app"
$env:VITE_FIREBASE_MESSAGING_SENDER_ID = "YOUR_MESSAGING_SENDER_ID"
$env:VITE_FIREBASE_APP_ID = "YOUR_FIREBASE_APP_ID"
$env:VITE_RECAPTCHA_ENTERPRISE_SITE_KEY = "YOUR_PRODUCTION_RECAPTCHA_SITE_KEY"
$env:RETENTION_WORKER_TOKEN = (Get-Content "PATH_TO_PROTECTED_WORKER_TOKEN_FILE" -Raw).Trim()
```

Run the complete sequence in [DOCKER_DEPLOYMENT_RUNBOOK.md](DOCKER_DEPLOYMENT_RUNBOOK.md). The primary command is:

```powershell
.\scripts\provision-cloud-run.ps1 -ProjectId YOUR_PROJECT_ID -Region asia-southeast1 -ServiceName personal-gemini-journal -ImageTag release-20260903-143000
```

The command builds with `gcloud builds submit`, deploys with `gcloud run deploy --image`, binds `GEMINI_API_KEY`, `DELETION_HMAC_KEY`, and `RETENTION_WORKER_TOKEN` at runtime, applies `dev-tutorial=cloud-run-ai-challenge`, and creates or updates the daily retention scheduler. `--allow-unauthenticated` allows the browser to reach the container; it does not bypass Firebase ID-token or App Check checks on `/api`.

If the Cloud Run hostname is not yet allowed by the reCAPTCHA key, use the explicit `-DisableAppCheck` staging switch once, register the actual hostname, then rerun without that switch. The disabled pass is not production-ready.

After deployment:

1. Add the Cloud Run hostname to Firebase Authentication Authorized Domains.
2. Deploy the Firestore rules: `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.
3. Verify the live user journey, App Check rejection, dedicated runtime identity, secret bindings, required label, scheduler, deletion lifecycle, and integrity endpoint.
4. Record the image digest, revision, URL, errors, and timing in [CLOUD_IMPLEMENTATION_RUNBOOK.md](CLOUD_IMPLEMENTATION_RUNBOOK.md).

### Configure Firebase App Check

1. In Firebase Console, open **App Check**, select the production web app, and register a score-based reCAPTCHA Enterprise provider.
2. Configure the provider for the deployed Cloud Run hostname. Keep localhost out of the production reCAPTCHA key; emulator development uses App Check disabled.
3. Pass the resulting site key to `-RecaptchaEnterpriseSiteKey` when running `scripts/provision-cloud-run.ps1`. The value is public browser configuration and is embedded at frontend build time; it is not a server secret.
4. Confirm the normal deployed browser flow succeeds, then use a controlled request to verify that missing or invalid `X-Firebase-AppCheck` is rejected with `401`.
5. If Firestore App Check enforcement is enabled in Firebase Console, repeat the journal read and write smoke tests because the Firebase client also attaches App Check tokens to Firestore requests.

### Configure delayed redaction

The server intentionally does not use Firestore TTL for this feature: the desired operation after 30 days is a controlled redaction, not deletion of the retention document. Configure the two lifecycle secrets before deployment:

```powershell
gcloud secrets create DELETION_HMAC_KEY
gcloud secrets create RETENTION_WORKER_TOKEN
gcloud secrets versions add DELETION_HMAC_KEY --data-file=PATH_TO_PROTECTED_HMAC_FILE
gcloud secrets versions add RETENTION_WORKER_TOKEN --data-file=PATH_TO_PROTECTED_WORKER_TOKEN_FILE
```

The provisioning script creates or updates the daily Cloud Scheduler HTTP job after deployment. It sends a bounded `{"limit":50}` request to the private route using the worker token in the `X-Retention-Worker-Token` header. The target scheduler is deployed and enabled, the retention index is ready, and a manual Scheduler invocation returned HTTP 200 with an empty batch. A controlled due-record transformation remains the final retention evidence. Use a protected PowerShell environment variable for the token; do not place it in source control or a committed file. This v1 worker boundary uses a static custom header because the public Cloud Run service must remain reachable by the browser; rotate the Cloud Run secret and scheduler job together.

```powershell
# Re-run the provisioning script to create or update the job idempotently.
.\scripts\provision-cloud-run.ps1 -ProjectId YOUR_PROJECT_ID -RecaptchaEnterpriseSiteKey YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY
```

The endpoint processes up to 50 due entries per run by default and accepts a bounded JSON `limit` from 1 to 200. Monitor the job and confirm `entry_redacted` audit events appear. Without this scheduler, entries remain protected in pending retention storage beyond the nominal deadline; the UI still stays private.

## 6. Production hardening

The dedicated service accounts are no longer deferred recommendations: `scripts/provision-cloud-run.ps1` creates a build identity for Cloud Build and Artifact Registry, plus a separate runtime identity with only Firestore and named Secret Manager access. Verify the runtime identity with:

```powershell
gcloud run services describe personal-gemini-journal `
  --region asia-southeast1 `
  --format="value(spec.template.spec.serviceAccountName)"
```

Keep `DELETION_HMAC_KEY` stable while retained audit records may need to be correlated. Rotate `RETENTION_WORKER_TOKEN` by updating Cloud Run and the scheduler job together, then invoke the endpoint once with the new token and confirm an unauthorized old token is rejected.

Firebase App Check is implemented for the custom API. The frontend initializes the score-based reCAPTCHA Enterprise provider and sends `X-Firebase-AppCheck`; the server verifies it through the Firebase Admin SDK when `ENFORCE_APP_CHECK=true`. Firebase Console App Check registration, the production key, and live rejection/success tests remain external verification steps.

Re-run the production smoke flow after changing the service account or enabling App Check because both changes affect request authorization and data access.

## 7. GitHub and Academy submission assets

Before publishing, inspect the proposed file list and confirm that `.env`, `.env.local`, `node_modules`, build output, emulator files, service-account keys, and deployment-only material are excluded. The detailed GitHub publication procedures are intentionally kept private; publishing source does not deploy Cloud Run.

```powershell
git init
git add .
git status
git commit -m "Personal Gemini Journal"
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

The repository should include:

- `README.md`
- `IMPLEMENTATION_GUIDE.md`
- `CONSTITUTION.md`
- `firestore.rules`
- `firestore.indexes.json`
- `Dockerfile`
- `cloudbuild.yaml`
- `DOCKER_DEPLOYMENT_RUNBOOK.md`
- `CLOUD_IMPLEMENTATION_RUNBOOK.md`
- The `web/` and `server/` source trees

The Academy submission should identify Firebase Authentication, Firestore isolation, Gemini multi-turn analysis, Cloud Run deployment, Privacy Guardian, App Check, hash-chain verification, retention redaction, and Calendar v1. It must include a public GitHub or GitLab repository, a public demo blog post or video social post using `#AccelerateAIwithCloudRun`, and a working Cloud Run prototype link. Claim App Check and automatic redaction as deployed capabilities only after the external production checks pass.

Submit through the Academy programme dashboard, which the event page identifies as the single source of truth for entries.

## 8. Optional features deliberately deferred

The codelab lists Maps, admin RBAC, and external notifications as optional expansion ideas. They are not part of the current version. Adding one should be a separate scoped change with updated threat modeling, secrets, access control, tests, and documentation.

The current version intentionally does not include semantic vector search or a second calendar collection. The calendar is derived from entries already loaded, which keeps deletion consistent and avoids duplicate state.

