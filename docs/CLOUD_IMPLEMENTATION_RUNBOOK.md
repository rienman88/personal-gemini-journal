# Cloud Implementation Runbook

## Purpose

This is the implementation-specific deployment and operations runbook for the Personal Gemini Journal application.

It is written for the project owner and for another operator who needs to deploy the same application safely. It is not a generic tutorial and it does not contain live project identifiers, secret values, user data, access tokens, image digests, revision names, or personal account details.

The application architecture and feature names below are intentionally specific to Personal Gemini Journal. Cloud project values are placeholders and must be filled from the operator's own Google Cloud and Firebase consoles.

## Setup Document Map

Use [SETUP_DOCUMENT_MAP.md](SETUP_DOCUMENT_MAP.md) first when onboarding a new operator. The setup is intentionally split by responsibility:

| Setup concern | Source of truth |
| --- | --- |
| Google AI Studio Custom Instructions | [CONSTITUTION.md](CONSTITUTION.md) |
| AI Studio and Academy requirements mapping | [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) |
| Docker, Cloud Build, and Artifact Registry | [DOCKER_DEPLOYMENT_RUNBOOK.md](DOCKER_DEPLOYMENT_RUNBOOK.md) |
| Firebase, Secret Manager, gcloud, Cloud Run, IAM, Scheduler, and production checks | This runbook |
| End-to-end public operator flow | This runbook together with [DOCKER_DEPLOYMENT_RUNBOOK.md](DOCKER_DEPLOYMENT_RUNBOOK.md) |
| Manual tests and security evidence | [TEST_RESULTS.md](TEST_RESULTS.md), [USABILITY_CHECKLIST.md](USABILITY_CHECKLIST.md), and [OWASP_LLM_TOP10_COVERAGE.md](OWASP_LLM_TOP10_COVERAGE.md) |

Do not duplicate commands across documents when a source-of-truth document already owns that procedure. Use this runbook to connect the cloud configuration and deployment layers.

## Scope and Security Boundary

Accurate version 1 security claim:

> Journal data is isolated per authenticated user and protected from unauthorized application clients. Privileged Google Cloud operators and the backend runtime remain trusted components.

The application does not claim that Firebase or Google Cloud administrators are cryptographically unable to view stored plaintext. Human IAM access and the backend runtime are trusted components. The practical hardening controls are:

- Keep human IAM access least-privilege.
- Remove unnecessary project-wide roles such as roles/editor only after Policy Simulator review.
- Separate deployment, runtime, audit, and break-glass responsibilities.
- Retain Cloud Audit Logs and review access to Firestore and Secret Manager.
- Never place Gemini credentials, service-account keys, worker tokens, Firebase Admin credentials, or user journal content in the repository or browser bundle.

## Application Capabilities

The current implementation includes:

- Firebase Google account sign-in.
- Per-user identity isolation using the authenticated Firebase UID.
- User-controlled AI Journal / Private Journal mode persisted per user and enforced by the Express API before any Gemini operation.
- Server-side Firebase Admin bearer-token verification.
- Firebase App Check with score-based reCAPTCHA Enterprise for the public web client.
- Fail-closed App Check validation for protected API routes.
- User-owned Firestore paths under users/{uid}.
- Firestore rules preventing one authenticated user from reading another user's data.
- Server-side Gemini analysis through Secret Manager-backed configuration.
- HMAC protection for deletion-actor identifiers through Secret Manager-backed configuration.
- Privacy Guardian interception before Gemini receives detected secret-like content.
- Safe redaction or explicit send-as-is consent.
- Closed-set category clustering and related-entry graph links. This is not vector search or semantic embedding search.
- Journal calendar populated from visible journal entries.
- Calendar removal when the corresponding journal entry is deleted or becomes invisible.
- Individual journal deletion.
- Delete All Journal Data flow.
- Privacy-safe retention container for deleted entries.
- Retention worker that replaces content and reflection with Deleted after the retention period while preserving non-content integrity and audit metadata.
- SHA-256 journal and conversation hash chains.
- Server-side rehash and integrity verification.
- Security Activity audit drawer.
- Cloud Run deployment using a dedicated runtime service account.
- Cloud Scheduler invocation for retention processing using a protected worker token.
- Required cohort verification label: dev-tutorial=cloud-run-ai-challenge.

## Operator Variables

Use these values in the current Personal Gemini Journal deployment unless the project owner intentionally chooses a different resource name.

~~~powershell
$ProjectId = "YOUR_GCP_PROJECT_ID"
$Region = "asia-southeast1"
$ServiceName = "personal-gemini-journal"
$RuntimeServiceAccountName = "personal-gemini-journal-run"
$BuildServiceAccountName = "personal-gemini-journal-build"
$ArtifactRepository = "cloud-run-images"
$SchedulerJobName = "personal-gemini-journal-retention"
$RequiredLabelKey = "dev-tutorial"
$RequiredLabelValue = "cloud-run-ai-challenge"
~~~

The following values must be discovered from the operator's own environment and must not be copied from another deployment:

- Firebase web configuration values.
- Firebase App Check reCAPTCHA Enterprise site key.
- Cloud Run service URL.
- Firebase authorized domains.
- Artifact Registry image digest.
- Cloud Run revision name.
- Secret version numbers.
- Service-account email addresses.
- Cloud Build operation IDs.
- Cloud Scheduler job URL.

## Master Deployment Checklist

### Repository and local safety

- [ ] Confirm the checkout is the intended Personal Gemini Journal source tree.
- [ ] Confirm local environment files are ignored.
- [ ] Confirm service-account JSON files are ignored.
- [ ] Confirm build output, logs, test artifacts, and node_modules are ignored.
- [ ] Scan tracked files for API keys, bearer tokens, private keys, cookies, user notes, and Firestore exports.
- [ ] Confirm the public repository contains documentation and templates, not operator secret values.

### Firebase

- [ ] Select the intended Firebase project.
- [ ] Enable Google Sign-In.
- [ ] Add localhost and the deployed Cloud Run hostname to Firebase Authentication Authorized Domains.
- [ ] Create or confirm the Firestore database.
- [ ] Deploy the repository Firestore rules.
- [ ] Register the web app and copy its public Firebase web configuration into the local protected environment file.
- [ ] Register the deployed web app with Firebase App Check.
- [ ] Create a score-based reCAPTCHA Enterprise website key.
- [ ] Add the local development host and deployed hostname to the reCAPTCHA key domain list.
- [ ] Confirm the key is associated with the same Firebase web app used by this build.
- [ ] Confirm Firebase App Check shows the app as Registered.

### Google Cloud

- [ ] Install the Google Cloud CLI and confirm gcloud is available in the current shell.
- [ ] Authenticate the operator account.
- [ ] Select the intended project.
- [ ] Enable required APIs through the provisioning script.
- [ ] Create or confirm the dedicated runtime service account.
- [ ] Create or confirm the dedicated build service account.
- [ ] Grant only the permissions required by the documented build, runtime, and scheduler paths.
- [ ] Create or confirm the Artifact Registry repository.
- [ ] Create or confirm GEMINI_API_KEY, DELETION_HMAC_KEY, and RETENTION_WORKER_TOKEN in Secret Manager.
- [ ] Confirm the Cloud Run service uses the dedicated runtime account.
- [ ] Confirm the Cloud Scheduler job uses its intended authenticated invocation path.
- [ ] Confirm Cloud Run has the required cohort label.

### Release and evidence

- [ ] Build and push the image with a unique release tag.
- [ ] Deploy Cloud Run with App Check enforcement enabled.
- [ ] Confirm the service becomes Ready and receives the intended traffic percentage.
- [ ] Confirm the public URL loads after a hard refresh.
- [ ] Complete the browser smoke and production security checks.
- [ ] Record only non-sensitive evidence: service name, region, label, status, and test outcome.
- [ ] Do not record tokens, secret values, raw journal content, or private account information in public evidence.

## Google AI Studio Setup Handoff

This repository separates the AI Studio instruction layer from the cloud deployment layer.

1. Open Google AI Studio Build mode and create or select the Personal Gemini Journal app.
2. Open System Instructions or Custom Instructions.
3. Paste the complete contents of [CONSTITUTION.md](CONSTITUTION.md).
4. Confirm the instructions preserve the current Express, Firebase Admin, Firestore, Privacy Guardian, calendar, retention, and hash-chain boundaries.
5. Use the AI Studio requirements mapping in [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) for the codelab flow and Firebase setup prompt.
6. Accept the Firebase setup terms when AI Studio prompts for them.
7. Review any generated change against the local source, tests, Firestore rules, and deployment script before accepting it.
8. After adding a capability, update the feature contract, threat model, tests, and documentation together.

AI Studio is the secure build-instruction and prototyping layer. It is not the runtime secret store, Firestore authorization layer, or Cloud Run deployment authority. The checked-in source and tests remain authoritative for the deployed application.

## Firebase Configuration

### Authentication

In Firebase Console for the operator's project:

1. Open Authentication.
2. Enable Google as a sign-in provider.
3. In Authorized domains, keep the Firebase default domains and add:
   - localhost for local development.
   - The hostname only for the deployed Cloud Run URL.
4. Do not add a full path, protocol, query string, or trailing slash.
5. Re-test Google Sign-In after adding a new deployment hostname.

The browser receives only public Firebase web configuration. Firebase Admin credentials and Gemini secrets remain server-side.

### Firestore

The data model is user-scoped:

~~~text
users/{uid}
  entries/{entryId}
    conversation/{turnId}
  audit/{auditId}
  meta/{documentId}
  retentionEntries/{entryId}
  retentionTurns/{turnId}
~~~

The normal UI reads visible entries from users/{uid}/entries. On deletion, the full record is copied into retentionEntries, the active entry is replaced with a minimal tombstone, and the UI hides that tombstone. Audit records remain separate from the journal content lifecycle.

Deploy rules from the repository after verifying the target project:

~~~powershell
firebase use YOUR_GCP_PROJECT_ID
firebase deploy --only firestore:rules
~~~

Use the Firebase CLI project selected for this deployment. Do not publish console exports containing real users or real journal content.

### App Check and reCAPTCHA Enterprise

This application uses Firebase App Check backed by a score-based reCAPTCHA Enterprise website key.

The site key is public client configuration, but it must still be restricted to the intended domains. The site key is not a replacement for Firebase Auth and is not a server secret.

Required setup:

1. Create or select the score-based website key in Google Cloud reCAPTCHA Enterprise.
2. Add localhost for development and the deployed Cloud Run hostname for production.
3. Register the Firebase web app under Firebase Console App Check.
4. Select reCAPTCHA Enterprise as the attestation provider.
5. Confirm the app status is Registered.
6. Build the site key into the web client through the protected build-time environment input.
7. Deploy with App Check enforcement enabled.
8. Verify that valid browser requests carry X-Firebase-AppCheck.
9. Verify that missing or invalid App Check tokens receive HTTP 401 from protected API routes.

During a temporary bootstrap deployment only, the provisioning script may accept DisableAppCheck if a project has not finished registration. Remove that flag for every production deployment. The app is not fully production-ready while enforcement is disabled.

## Secret Manager

Secrets must be created in the operator's Google Cloud project and accessed by reference at runtime or by protected build input as documented.

Recommended secret inventory:

| Secret | Use | Exposure boundary |
| --- | --- | --- |
| GEMINI_API_KEY | Server-side Gemini API access | Cloud Run runtime only |
| DELETION_HMAC_KEY | HMACs the actor identifier stored with deleted data | Cloud Run runtime only |
| RETENTION_WORKER_TOKEN | Authenticates the retention worker request | Cloud Scheduler and Cloud Run runtime only |
| Firebase Admin credentials, if required by the implementation | Server-side Firebase Admin initialization | Cloud Run runtime only |

Do not commit secret values, service-account JSON, or copied command output containing secret values.

Example secret creation pattern:

~~~powershell
"REPLACE_WITH_SECRET_VALUE" | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project=$ProjectId
"REPLACE_WITH_RANDOM_HMAC_KEY" | gcloud secrets versions add DELETION_HMAC_KEY --data-file=- --project=$ProjectId
"REPLACE_WITH_RANDOM_WORKER_TOKEN" | gcloud secrets versions add RETENTION_WORKER_TOKEN --data-file=- --project=$ProjectId
~~~

Use an interactive or protected secret source instead of putting real values into shell history. Grant the dedicated runtime service account only the Secret Manager accessor permission required by these secrets. If a build step needs a secret, prefer a protected build substitution or runtime reference and verify that the value cannot be included in the client bundle.

To inspect metadata without printing secret values:

~~~powershell
gcloud secrets list --project=$ProjectId
gcloud secrets describe GEMINI_API_KEY --project=$ProjectId
gcloud secrets describe DELETION_HMAC_KEY --project=$ProjectId
gcloud secrets describe RETENTION_WORKER_TOKEN --project=$ProjectId
~~~

## Google Cloud CLI Setup

Confirm the CLI before running the deployment:

~~~powershell
Get-Command gcloud
gcloud version
gcloud auth login
gcloud config set project $ProjectId
gcloud config get-value project
~~~

If gcloud is installed but not on PATH, locate the actual installation directory and invoke its gcloud.cmd directly. Do not assume a temporary archive directory. The deployment cannot proceed safely until gcloud config get-value project returns the intended project.

## Production Build Inputs

The web build requires the public Firebase configuration and App Check site key. Read these from the operator's protected local configuration, not from this runbook.

The provisioning script accepts the six VITE_FIREBASE_* values as parameters or environment variables. It does not automatically load web/.env.local. Load the protected values into the current shell, or pass the matching script parameters, before running the provisioning command.

Expected public build variables:

~~~text
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_WEB_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_WEB_APP_ID
VITE_USE_EMULATORS=false
VITE_ENABLE_APP_CHECK=true
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY
VITE_API_BASE_URL=
~~~

The client bundle may contain the Firebase web configuration and reCAPTCHA site key. It must not contain GEMINI_API_KEY, RETENTION_WORKER_TOKEN, Firebase Admin credentials, or any private key.

## Docker Setup Handoff

The supported release path uses an explicit container boundary:

~~~text
Dockerfile -> Cloud Build -> Artifact Registry -> Cloud Run
~~~

Use [DOCKER_DEPLOYMENT_RUNBOOK.md](DOCKER_DEPLOYMENT_RUNBOOK.md) for the detailed container procedure. Its roles are:

- Dockerfile builds the web client and server in separate stages, then creates the lean runtime image.
- cloudbuild.yaml passes public frontend build inputs and pushes the image to Artifact Registry.
- .dockerignore and .gcloudignore keep local secrets, build output, logs, emulator data, and test artifacts out of the build context.
- scripts/provision-cloud-run.ps1 creates or confirms the build/runtime identities, named Secret Manager bindings, Cloud Run service, App Check settings, required cohort label, and retention Scheduler.

The cloud runbook owns project configuration and post-deployment checks; the Docker runbook owns container build alternatives and image-release troubleshooting. Do not add Gemini credentials, deletion HMAC material, worker tokens, Firebase Admin credentials, or journal data to Docker build arguments or image layers.

## Provision and Deploy

The repository script is the supported path because it centralizes API enablement, IAM, Artifact Registry, Secret Manager references, Cloud Run, Scheduler, and the required cohort label.

Run it from the repository root:

~~~powershell
.\scripts\provision-cloud-run.ps1 -ProjectId $ProjectId -Region $Region -ServiceName $ServiceName -ServiceAccountName $RuntimeServiceAccountName -BuildServiceAccountName $BuildServiceAccountName -ArtifactRepository $ArtifactRepository -RecaptchaEnterpriseSiteKey $env:VITE_RECAPTCHA_ENTERPRISE_SITE_KEY -ImageTag "release-YYYYMMDD-HHMMSS"
~~~

Before running, confirm:

- The App Check site key is the real key for this Firebase web app.
- The Firebase public values are loaded into the build environment.
- RETENTION_WORKER_TOKEN is loaded in the current protected shell because the script uses it to configure the scheduler header.
- GEMINI_API_KEY, DELETION_HMAC_KEY, and RETENTION_WORKER_TOKEN exist in Secret Manager.
- The target project is correct.
- The required APIs and billing are available.
- The working tree does not contain files that must not enter the build context.

The script should create or update the following logical resources:

- Artifact Registry repository cloud-run-images.
- Dedicated build service account personal-gemini-journal-build.
- Dedicated runtime service account personal-gemini-journal-run.
- Cloud Run service personal-gemini-journal.
- Cloud Scheduler job personal-gemini-journal-retention.
- Runtime secret references for Gemini, deletion-actor HMAC, and retention processing.
- Cloud Run label dev-tutorial=cloud-run-ai-challenge.

Cloud Build can appear to pause at "Waiting for build to complete". Check the build in Cloud Build history before cancelling it. If logs are unavailable through the default command, inspect the operation in the Cloud Console or use the beta build command supported by the installed CLI. A cancelled build is not a deployment result and must be recorded as BLOCKED or CANCELLED, not PASSED.

## Post-Deployment Checks

Run these commands without printing secret values:

~~~powershell
gcloud run services describe $ServiceName --project=$ProjectId --region=$Region --format="yaml(metadata.name,metadata.labels,status.url,status.latestReadyRevisionName,status.traffic,spec.template.spec.serviceAccountName)"
gcloud run services get-iam-policy $ServiceName --project=$ProjectId --region=$Region
gcloud scheduler jobs describe $SchedulerJobName --project=$ProjectId --location=$Region
~~~

Verify:

- The service is Ready.
- The service URL is the expected URL for this deployment.
- The dedicated runtime service account is attached.
- 100 percent traffic points to the intended ready revision, unless a deliberate gradual rollout is in progress.
- The required label is present exactly as dev-tutorial: cloud-run-ai-challenge.
- App Check enforcement is enabled.
- The scheduler job is configured for the intended service and authentication path.
- Secret references exist without exposing secret values.

## Manual Production Verification

Use fictional content only. Never use real credentials or personal journal content in screenshots or recordings.

1. Open the deployed Cloud Run URL with a hard refresh.
   - Expected: the application loads without a blank screen.
2. Complete Google Sign-In.
   - Expected: the private journal dashboard appears.
3. Toggle between AI Journal and Private Journal.
   - Expected: the preference saves for the signed-in UID, the status explains the active policy, and a new Private Journal entry saves without a Gemini request or derived conversation.
4. Create a plain entry in AI Journal mode.
   - Expected: Gemini-derived summary, topics, and a reflection prompt appear.
5. Reply to the reflection.
   - Expected: Gemini responds in context and the conversation turn is stored.
6. Inspect the browser Network panel for the protected request such as /api/entries.
   - Expected: the request contains X-Firebase-AppCheck and an Authorization bearer token.
7. Copy the request as fetch, remove X-Firebase-AppCheck, and run it in the console.
   - Expected: HTTP 401.
8. Repeat with an invalid App Check value.
   - Expected: HTTP 401.
9. Trigger Privacy Guardian with the fictional fixture AKIAABCDEFGHIJKLMNOP.
   - Expected: the modal appears before the content is sent to Gemini, offering Redact before sending to Gemini or Send as-is anyway.
   - Note: this is an AWS-style fake credential fixture only. The application has no AWS integration.
10. Choose each Privacy Guardian action once.
   - Expected: the modal unmounts immediately after the selection and the intended request path continues.
11. Create two fictional entries that belong to the same closed-set category.
    - Expected: the UI displays the Related - shares a category relationship.
12. Open the journal calendar.
    - Expected: visible entries populate their dates; deleting or hiding an entry removes it from the calendar.
13. Verify journal integrity.
    - Expected: the response distinguishes total server-chain entries, visible entries, and pending-redaction entries. Example wording: CHAIN INTACT, total entries verified on server database, pending redaction count, visible entry count.
14. Open Security Activity.
    - Expected: audit events such as entry_created, pii_detected, and integrity_verified appear without exposing unnecessary secret content.
15. Delete one entry.
    - Expected: it disappears from the journal list and calendar, enters retention storage, and its audit history remains.
16. Use Delete All Journal Data.
    - Expected: all visible entries disappear, the confirmation modal closes after the action, retention records are created, and audit records remain.
17. Confirm user isolation with a second test account.
    - Expected: the second user cannot read, modify, or delete the first user's journal data through the application.
18. Run one controlled retention fixture.
    - Expected: after the configured retention threshold, content, reflection, summary, conversation text, topics, and PII metadata become Deleted or empty as implemented; timestamps, hashes, deletion metadata, and the separate audit record remain.
19. Inspect Firestore using an authorized operator account.
    - Expected: entries, conversation subcollections, retention collections, audit collections, hash fields, and deletion metadata match the documented data model.

Record each check as PASS, FAIL, BLOCKED, or NOT RUN. Do not claim a production gate is complete from local tests alone.

## Integrity and Retention Semantics

The journal chain is calculated server-side. Normal entry deletion does not erase the audit trail. Deleted entries are hidden from the journal UI immediately, their full records are retained in a protected retention container for 30 days, and the active collection retains a minimal tombstone for chain continuity.

After the retention period, the worker redacts content, reflection, summary, conversation text, topics, and PII metadata. The retention record preserves the fields implemented for auditability and integrity, including:

- uid
- entryId or turnId
- createdAt
- deletedAt
- redactedAt
- deletedByUidHash
- prevHash
- hash
- retentionState
- conversation role for retained turns
- deletion metadata
- conversation-chain metadata where present

The active tombstone retains uid, clientRequestId, journalMode, aiUsed, createdAt, prevHash, hash, deletionState, deletedAt, redactAt, and deletedByUidHash. After redaction, content-like fields are set to Deleted or an empty collection as appropriate. The exact field policy is defined by the server retention implementation and tests. If the policy changes, update this runbook, the Firestore rules, the retention tests, the README, and the public security claim together.

## Rollback

If a new revision is unhealthy:

~~~powershell
gcloud run revisions list --service=$ServiceName --project=$ProjectId --region=$Region
gcloud run services update-traffic $ServiceName --to-revisions=PREVIOUS_READY_REVISION=100 --project=$ProjectId --region=$Region
~~~

After rollback:

- Confirm the service is Ready.
- Re-run authentication, entry creation, App Check, and integrity smoke checks.
- Inspect Cloud Run logs for the failed revision.
- Record the rollback reason and revision identifiers in the private operator log.
- Do not publish raw logs containing tokens, prompts, user data, or secret values.

## Known Operational Issues and Safe Resolutions

### App verification unavailable

Likely causes include an unregistered App Check web app, an incorrect site key, a domain missing from the reCAPTCHA key, browser extension interference, or a deployment made with the wrong build-time variable.

Safe resolution:

- Confirm the Firebase App Check app is Registered.
- Confirm the site key belongs to the same Firebase web app.
- Confirm localhost and the deployed hostname are in the key domain list.
- Confirm the built client received the expected site-key value without exposing it in public documentation.
- Hard-refresh after deployment.
- Use an extension-free or incognito browser for verification.
- Confirm the server is enforcing the token and return to the deployment step if the key is incorrect.

### Cloud Build appears stalled

A build can still be running while the local polling command appears quiet. Check Cloud Build history and the operation status before cancelling. If it was cancelled, rerun with a new release tag after checking quotas, API enablement, build context size, and Dockerfile steps.

### Firestore console says a document does not exist

This usually means the console is holding a stale document URL after deletion, or the selected document was intentionally moved out of the visible entries collection into retentionEntries. Refresh the console and navigate from the current collection path. A deleted Firestore document is not corruption by itself.

### Console 404 or permission messages

Cloud Console can issue background requests for products or resources that are not enabled or are not available to the current console session. Distinguish these from application responses. Use the browser Network panel and the Cloud Run request logs to verify the actual application API status.

### Grammarly or browser-extension noise

grm or Grammarly console messages are injected by the extension and are not application failures. The UI may add data-gram=false to journal fields, but production verification should also be repeated in a clean profile with extensions disabled.

### Windows shell syntax

PowerShell environment-variable syntax does not work in cmd.exe, and cmd.exe continuation syntax does not work in PowerShell. Use one shell consistently. In PowerShell use $env:NAME; in cmd use set NAME=value. Verify the active shell before running a deployment command.

## Latest Verified Deployment Record

Recorded 2026-09-05 after publishing the AI Journal / Private Journal mode.

- Source commit: `508a949`
- Docker image tag: `release-20260905-ai-toggle`
- Ready revision: `personal-gemini-journal-00020-lww`
- Traffic: 100 percent to the ready revision
- App Check: enforced (`ENFORCE_APP_CHECK=true`)
- Runtime identity: dedicated `personal-gemini-journal-run` service account
- Required cohort label: `dev-tutorial=cloud-run-ai-challenge`
- Retention scheduler: enabled at `0 2 * * *` in `asia-southeast1`
- Canonical service URL: `https://personal-gemini-journal-eazyegerma-as.a.run.app`
- Alternate service URL: `https://personal-gemini-journal-709422088585.asia-southeast1.run.app`
- HTTP smoke: both service URLs returned `200` with the application HTML shell
- Live AI-mode walkthrough: remains a manual operator check; use the fictional test sequence in the public test matrix

## Private Execution Log Template

Keep project-specific values in a private operator record unless they are explicitly safe to publish.

| Time | Area | Action | Result | Evidence reference | Public-safe? |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD HH:MM | Firebase | App Check registration | PASS / BLOCKED | Console screenshot with secrets redacted | YES / NO |
| YYYY-MM-DD HH:MM | Google Cloud | Provisioning | PASS / BLOCKED | Private command output | NO |
| YYYY-MM-DD HH:MM | Cloud Build | Image build | PASS / BLOCKED | Build ID stored privately | NO |
| YYYY-MM-DD HH:MM | Cloud Run | Deployment | PASS / BLOCKED | Service status without URL if needed | YES / NO |
| YYYY-MM-DD HH:MM | Browser | Smoke verification | PASS / FAIL | Sanitized test result | YES |
| YYYY-MM-DD HH:MM | Retention | Controlled redaction fixture | PASS / BLOCKED | Sanitized audit event | YES / NO |
| YYYY-MM-DD HH:MM | IAM | Final least-privilege review | PASS / BLOCKED | Policy review record | NO |
| YYYY-MM-DD HH:MM | Academy | Submission package | PASS / BLOCKED | Submission confirmation | YES / NO |

## Public Repository Safety

Before publishing:

~~~powershell
rg --files -g "!**/node_modules/**" -g "!web-dist/**" -g "!server/lib/**" -g "!web/test-results/**" -g "!**/.env*" -g "!**/*.log"
rg -n --hidden -i -g "!**/node_modules/**" -g "!web-dist/**" -g "!server/lib/**" -g "!web/test-results/**" -g "!**/.env*" -g "!**/*.log" "AIza|BEGIN PRIVATE KEY|eyJ[a-zA-Z0-9_-]{20,}|GEMINI_API_KEY=|RETENTION_WORKER_TOKEN="
~~~

Review the output manually. Never rely only on a pattern scan. Check GitHub's repository secret scanning after publication and rotate anything that was exposed.

## Official References

- Cloud Run service identity: https://cloud.google.com/run/docs/securing/service-identity
- Cloud Run deployment: https://cloud.google.com/run/docs/deploying
- Secret Manager: https://cloud.google.com/secret-manager/docs
- Cloud Scheduler authenticated requests: https://cloud.google.com/scheduler/docs/http-target-auth
- Firebase App Check custom resources: https://firebase.google.com/docs/app-check/custom-resource
- Firebase App Check reCAPTCHA Enterprise for web: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- Firebase Authentication authorized domains: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Firestore security rules: https://firebase.google.com/docs/firestore/security/get-started
- Firestore IAM and access control: https://cloud.google.com/firestore/docs/security/iam
- Cloud Audit Logs: https://cloud.google.com/logging/docs/audit
- Google Cloud Policy Simulator: https://cloud.google.com/policy-intelligence/docs/simulate-policy

## Change Control

When changing the architecture or a security-sensitive behavior:

1. Update the implementation and tests.
2. Update Firestore rules and deployment scripts if affected.
3. Update README.md and the relevant runbooks.
4. Add or update a manual verification step.
5. Run the automated test suite and browser smoke tests.
6. Record external production gates separately from local evidence.
7. Review the public-safe scan before publishing.
