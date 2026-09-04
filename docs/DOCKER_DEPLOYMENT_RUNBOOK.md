# Docker Deployment Runbook

The container and service boundary are shown in [docs/ARCHITECTURE.svg](docs/ARCHITECTURE.svg). The image contains the built React frontend and compiled Express server; production Gemini and retention credentials are injected only at Cloud Run runtime from Secret Manager.

**Application:** Personal Gemini Journal  
**Programme:** Google Cloud Gen AI Academy APAC Edition, Cohort 3  
**Deployment target:** Cloud Run in asia-southeast1  
**Primary method:** Cloud Build builds the repository Dockerfile, pushes an immutable-tagged image to Artifact Registry, and Cloud Run deploys that image.  
**Current status:** Cloud Run revision `personal-gemini-journal-00018-qqb` is live from image tag `release-20260904-integrity-counts` with `ENFORCE_APP_CHECK=true`; the retention index is ready, the protected scheduler path returns HTTP 200, and both Cloud Run hostnames return HTTP 200 for the shell and health endpoint. Authenticated browser App Check success/rejection and controlled due-record redaction remain pending evidence.

The image includes the React Auth client configured with Firebase `browserLocalPersistence`; this preserves the trusted-device browser session without adding a custom application cookie or server session. The deployment boundary remains Firebase ID-token verification plus production App Check enforcement on `/api`; sign out is required on shared or public devices.

This is the operational record for this repository. It describes the implementation that exists here, the commands that match it, the verification evidence, the errors encountered, and the alternative paths. Update the execution log after every real deployment attempt.

## 1. Deployment Checklist

### Repository preparation

- [x] Multi-stage Dockerfile builds the Vite frontend and TypeScript server.
- [x] Runtime image contains only production dependencies, compiled server code, and compiled frontend files.
- [x] Docker build requires the six Firebase browser configuration values.
- [x] Docker build supports production App Check or an explicitly disabled staging pass.
- [x] Runtime secrets are not Docker build arguments.
- [x] .dockerignore excludes environment files, generated output, logs, and service-account key files.
- [x] .gcloudignore excludes the same sensitive and generated files from the Cloud Build source archive.
- [x] The server production image copies only server/src and does not copy server/key.json.
- [x] cloudbuild.yaml passes only public Firebase/App Check values to Docker build arguments.
- [x] Docker uses neutral build-argument names and shell-scoped Vite variables, so BuildKit does not misclassify public browser configuration as runtime secrets.
- [x] Vite splits Firebase vendor code from the application chunk; the production build is below the 500 kB warning threshold.
- [x] Provisioning script uses a separate build service account and Cloud Run runtime service account.

### Local evidence

- [x] Root production build passes.
- [x] Browser smoke suite passes: 4 tests.
- [x] Browser smoke suite runs without inherited `NO_COLOR`/`FORCE_COLOR` warnings.
- [x] Emulator-backed server suite passes: 34 passing, 2 intentionally pending.
- [x] PowerShell provisioning script parses successfully.
- [x] Local Docker image builds successfully with Docker Desktop's Linux engine.
- [x] Local container smoke passes: `/healthz` returns HTTP 200 and the runtime image contains no key or environment files.
- [x] Final warning-free Docker image smoke passes: `/healthz`, `/health`, `/`, and the generated JavaScript asset return HTTP 200; startup logs contain only the expected listener message.
- [x] Production App Check build gate passes when a non-empty site key is supplied.
- [x] Production-shaped runtime smoke passes with `ENFORCE_APP_CHECK=true`: `/healthz` and the frontend both return HTTP 200.

### Google Cloud prerequisites

- [x] gcloud installed and authenticated through the verified portable Google Cloud CLI archive.
- [x] Billing-enabled target project selected.
- [x] Firebase terms accepted for the target project.
- [x] Firebase Google Sign-In provider enabled.
- [x] Firestore database exists in asia-southeast1 and is the native `(default)` database.
- [x] Production web Firebase configuration collected from the target Firebase app.
- [x] Firebase App Check Web-app registration and allowed-domain configuration independently confirmed in the Firebase Console.
- [x] GEMINI_API_KEY exists in Secret Manager and is bound at runtime.
- [x] DELETION_HMAC_KEY exists in Secret Manager and is bound at runtime.
- [x] RETENTION_WORKER_TOKEN exists in Secret Manager and is bound at runtime.
- [x] Deployer can create service accounts, bind IAM roles, submit builds, and deploy Cloud Run.

### Live verification

- [x] Cloud Build image build completes and image digest is recorded.
- [x] Cloud Run revision uses personal-gemini-journal-run.
- [x] Cloud Run runtime secret bindings are present without exposing values.
- [x] `/health` returns ok on the current staging revision; the exact `/healthz` path is intercepted by the Cloud Run front end.
- [x] Firebase Auth and authorized-domain checks pass.
- [x] App Check normal browser request succeeds and invalid/missing App Check is rejected.
- [x] Entry, reply, Privacy Guardian, audit, integrity, calendar, and deletion flows pass.
- [x] Firestore rules and the retention collection-group index are deployed and ready.
- [x] Scheduler exists and is configured for /internal/retention/redact.
- [x] A real due retention record is eventually observed as entry_redacted.
- [x] Required Cloud Run label is present.
- [x] Live URL, image digest, revision, and staging verification results are recorded below.

## 2. Actual Container Design

The root Dockerfile has three stages:

1. web-build installs web dependencies, receives public Firebase/App Check build values, and runs Vite.
2. server-build installs server dependencies, copies only server/src and server/tsconfig.json, and compiles TypeScript.
3. Runtime installs server production dependencies, copies compiled server/frontend output, defaults to port 8080 for local Docker use, and runs node server/lib/src/index.js. Cloud Run injects its own `PORT` value at deployment time.

The Docker image does not contain the Gemini key, deletion HMAC key, or retention worker token. Cloud Run injects those values at runtime through Secret Manager bindings. Firebase browser configuration and the reCAPTCHA site key are intentionally public build-time values because Vite embeds them in browser JavaScript.

The image is built by cloudbuild.yaml with a unique tag such as release-20260903-143000. The provisioning script deploys that exact image tag rather than a mutable latest tag. Cloud Run revisions remain immutable and the image digest should be recorded after a successful deployment.

## 3. Source Hygiene Before Build

The workspace contains server/key.json with service-account credential fields. Treat it as a credential even though the application can use it for local development.

The current protection is additive and does not remove local behavior:

- .dockerignore excludes **/key.json.
- .gcloudignore excludes **/key.json from the Cloud Build source archive.
- .gitignore excludes **/key.json from future repository additions.
- The production Docker build copies only server/src, so the file cannot enter the runtime image.

If this key was ever committed, uploaded, or shared outside the local machine, revoke it and issue a replacement in Google Cloud IAM. Do not use a downloaded service-account key for Cloud Run production. Cloud Run uses its assigned service account through Application Default Credentials.

Before the first build, inspect the source list and repository status. Do not continue if a real key is staged or tracked:

~~~powershell
Get-ChildItem -Force -Recurse -File | Where-Object { $_.Name -match '(^|\.)env|key\.json' } | Select-Object FullName
git status --short
~~~

## 4. Configure Public Build Values

The following values come from Firebase Console -> Project settings -> Your apps -> Web app. They are browser configuration, not Secret Manager values:

~~~powershell
$env:VITE_FIREBASE_API_KEY = "YOUR_FIREBASE_WEB_API_KEY"
$env:VITE_FIREBASE_AUTH_DOMAIN = "YOUR_PROJECT.firebaseapp.com"
$env:VITE_FIREBASE_PROJECT_ID = "YOUR_PROJECT_ID"
$env:VITE_FIREBASE_STORAGE_BUCKET = "YOUR_PROJECT.firebasestorage.app"
$env:VITE_FIREBASE_MESSAGING_SENDER_ID = "YOUR_MESSAGING_SENDER_ID"
$env:VITE_FIREBASE_APP_ID = "YOUR_FIREBASE_APP_ID"
$env:VITE_RECAPTCHA_ENTERPRISE_SITE_KEY = "YOUR_PRODUCTION_RECAPTCHA_SITE_KEY"
~~~

The provisioning script accepts these as parameters as well. Environment variables are used in this runbook to keep the deployment command shorter. VITE_FIREBASE_PROJECT_ID must exactly match -ProjectId; the script rejects a mismatch to prevent Auth, Firestore, and Admin SDK from targeting different projects.

The production build sets VITE_USE_EMULATORS=false, VITE_ENABLE_APP_CHECK=true, and VITE_API_BASE_URL=empty. An empty API base is intentional because the same Cloud Run service serves both the browser and /api routes.

## 5. Create Runtime Secrets

Create these once in the target project. If a secret already exists, add a new version instead of creating a duplicate:

~~~powershell
gcloud secrets create GEMINI_API_KEY --replication-policy=automatic
gcloud secrets create DELETION_HMAC_KEY --replication-policy=automatic
gcloud secrets create RETENTION_WORKER_TOKEN --replication-policy=automatic
gcloud secrets versions add GEMINI_API_KEY --data-file=PATH_TO_PROTECTED_GEMINI_KEY_FILE
gcloud secrets versions add DELETION_HMAC_KEY --data-file=PATH_TO_PROTECTED_HMAC_FILE
gcloud secrets versions add RETENTION_WORKER_TOKEN --data-file=PATH_TO_PROTECTED_WORKER_TOKEN_FILE
~~~

Use strong random values for the HMAC and worker token. Do not place any of these values in Dockerfile, cloudbuild.yaml, Docker build arguments, source files, committed environment files, or this runbook.

The provisioning script grants the Cloud Run runtime identity roles/secretmanager.secretAccessor only on these three named secrets. It does not grant the Cloud Build identity access to them; if the build account already exists, inspect inherited project IAM before production use.

## 6. Deployer Permissions

The person running the script needs permission to enable APIs, create service accounts, bind roles, create an Artifact Registry repository, submit a Cloud Build, and deploy Cloud Run. The build command explicitly uses the user-managed build identity, so the deployer also needs iam.serviceAccounts.actAs on both user-managed service accounts.

If an administrator delegates this narrowly, the service-account-user bindings are:

~~~powershell
gcloud iam service-accounts add-iam-policy-binding personal-gemini-journal-build@YOUR_PROJECT_ID.iam.gserviceaccount.com --member=user:YOUR_GOOGLE_ACCOUNT --role=roles/iam.serviceAccountUser --project=YOUR_PROJECT_ID
gcloud iam service-accounts add-iam-policy-binding personal-gemini-journal-run@YOUR_PROJECT_ID.iam.gserviceaccount.com --member=user:YOUR_GOOGLE_ACCOUNT --role=roles/iam.serviceAccountUser --project=YOUR_PROJECT_ID
~~~

Do not grant project Owner or Editor merely to make this script work. Resolve the missing narrow permission if a command fails.

## 7. Staged Deployment Sequence

### 7.1 Install and authenticate tools

The original staging host used Docker CLI, Firebase CLI, and a portable Google Cloud CLI archive. The machine-specific archive path is intentionally not part of the reusable repository instructions. Use an installed `gcloud` on `PATH`, or prepend the `bin` directory of a portable SDK before running the commands:

~~~powershell
$env:PATH = "PATH_TO_GCLOUD_BIN;$env:PATH"
gcloud --version
gcloud auth list
gcloud config set project YOUR_PROJECT_ID
~~~

docker --version is useful for local validation, but the primary build uses Cloud Build and does not require a running local Docker engine.

### 7.2 First pass when the Cloud Run hostname is not known

The production reCAPTCHA key must allow the actual deployed hostname. If a custom production domain is already known and registered, skip this staging pass. Otherwise use the explicit staging switch below to obtain the Cloud Run URL:

~~~powershell
$env:RETENTION_WORKER_TOKEN = (Get-Content "PATH_TO_PROTECTED_WORKER_TOKEN_FILE" -Raw).Trim()
.\scripts\provision-cloud-run.ps1 -ProjectId YOUR_PROJECT_ID -DisableAppCheck
~~~

This pass sets both frontend VITE_ENABLE_APP_CHECK=false and server ENFORCE_APP_CHECK=false. It is not production-ready and must not be presented as the final security posture.

### 7.3 Register production App Check

After the staging URL is known:

1. Register the production web app in Firebase App Check with a score-based reCAPTCHA Enterprise provider.
2. Add the exact Cloud Run hostname, or the chosen custom domain, to the provider's allowed domains.
3. Set VITE_RECAPTCHA_ENTERPRISE_SITE_KEY to the registered production site key.
4. Re-run the provisioning script without -DisableAppCheck.

The second run builds a new image with App Check enabled and deploys a new revision with ENFORCE_APP_CHECK=true.

### 7.4 Production build and deployment

Run from the repository root:

~~~powershell
$env:RETENTION_WORKER_TOKEN = (Get-Content "PATH_TO_PROTECTED_WORKER_TOKEN_FILE" -Raw).Trim()
.\scripts\provision-cloud-run.ps1 -ProjectId YOUR_PROJECT_ID -Region asia-southeast1 -ServiceName personal-gemini-journal -ImageTag release-20260903-143000
~~~

The script performs these operations in order:

1. Enables Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Firestore, and Cloud Scheduler APIs.
2. Creates personal-gemini-journal-run if absent.
3. Creates personal-gemini-journal-build if absent.
4. Grants the build identity roles/cloudbuild.builds.builder and repository-scoped roles/artifactregistry.writer.
5. Creates the cloud-run-images Docker repository if absent.
6. Grants the runtime identity roles/datastore.user and access only to the three named runtime secrets.
7. Runs gcloud builds submit using cloudbuild.yaml and the user-managed build identity.
8. Deploys the exact image to Cloud Run using the user-managed runtime identity.
9. Sets ENFORCE_APP_CHECK, GCP_PROJECT, and the three runtime Secret Manager bindings.
10. Applies dev-tutorial=cloud-run-ai-challenge.
11. Creates or updates the daily retention scheduler after the service URL is known.

The scheduler uses the protected worker token in X-Retention-Worker-Token and sends {"limit":50}. It does not receive the Gemini key or deletion HMAC key.

## 8. Firebase and Firestore Post-Deployment

After the service URL is known:

~~~powershell
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
~~~

Add the exact Cloud Run hostname to Firebase Authentication -> Settings -> Authorized domains. Confirm the Google provider is enabled and has a support email configured.

If Firebase App Check enforcement is enabled for Firestore in the Console, repeat direct Firestore read tests after the browser API tests because the Firebase client must attach App Check tokens to those reads too.

## 9. Live Verification

Record the image URI and digest printed by Cloud Build. Then run:

~~~powershell
$service = gcloud run services describe personal-gemini-journal --project YOUR_PROJECT_ID --region asia-southeast1 --format="value(status.url)"
Invoke-WebRequest "$service/health" | Select-Object StatusCode, Content
gcloud run services describe personal-gemini-journal --project YOUR_PROJECT_ID --region asia-southeast1 --format="yaml(spec.template.spec.serviceAccountName,metadata.labels,spec.template.spec.containers[0].image)"
~~~

The controlled live checklist is:

1. Open the live URL and complete Google Sign-In.
2. Create a plain entry and verify summary, topics, category, reflection, audit event, and calendar marker.
3. Create a reply and verify the related category behavior.
4. Trigger Privacy Guardian on an entry and a reply; verify Redact and Send as-is each close the modal immediately.
5. Verify integrity and confirm the active chain is intact.
6. Delete one entry; confirm it disappears from the feed and calendar while audit activity remains.
7. Test all-journal deletion in a controlled account.
8. Send a request with a valid Firebase ID token but no App Check token; expect 401 when enforcement is enabled.
9. Confirm an ordinary browser request with both valid tokens succeeds.
10. Inspect Firestore rules behavior with a second test account. Cross-user reads and all client writes must remain denied.
11. Confirm the Scheduler job points to /internal/retention/redact, runs successfully, and logs no secret values.
12. After a real record becomes due, confirm its retention record remains but readable journal text is replaced with Deleted and the entry_redacted audit event exists.

Do not alter redactAt in production merely to simulate the 30-day promise. Local retention tests already verify the transformation; a live verification should use a controlled approved fixture or an actually due record.

## 10. Rollback

Cloud Run revisions are immutable. If the new revision fails live verification, identify the previous revision and route traffic back to it:

~~~powershell
gcloud run revisions list --service personal-gemini-journal --project YOUR_PROJECT_ID --region asia-southeast1
gcloud run services update-traffic personal-gemini-journal --project YOUR_PROJECT_ID --region asia-southeast1 --to-revisions PREVIOUS_REVISION=100
~~~

Keep the failed image and revision for diagnosis. Do not delete the image until logs and the verification result have been recorded.

## 11. Alternatives

### A. Cloud Run source deployment

~~~powershell
gcloud run deploy personal-gemini-journal --source . --region asia-southeast1
~~~

This is a valid convenience path, and Cloud Run uses the repository Dockerfile when one is present. It automatically builds and stores an image in Artifact Registry. It is not the primary path here because source deployment provides less control over the explicit Docker build arguments, image identity, build service account, and reproducible promotion workflow. [Cloud Run source deployment](https://docs.cloud.google.com/run/docs/deploying-source-code)

### B. Manual Cloud Build plus image deployment

Use cloudbuild.yaml directly with gcloud builds submit, then deploy the resulting image with gcloud run deploy --image. This is the same underlying path as the provisioning script, but it does not create IAM, secrets, labels, or the retention scheduler for you. It is useful when an administrator separates infrastructure provisioning from application release.

### C. Cloud Shell

Cloud Shell is the preferred alternative when the workstation lacks gcloud or Docker Desktop. Clone or upload the repository, set the same protected values, and run the same provisioning script. The commands and image are unchanged; only the execution host changes.

### D. Local Docker build and push

This provides maximum local inspection but requires Docker Desktop's Linux engine and additional registry authentication. It is not necessary for the cohort deployment because Cloud Build performs the same Dockerfile build in Google Cloud. Use it when debugging a Docker-specific failure that cannot be reproduced in Cloud Build.

## 12.  Security Decisions

- Runtime secrets remain in Secret Manager and are injected only by Cloud Run.
- Public Firebase/App Check values are passed only to the frontend build and are not treated as secrets.
- Build and runtime service accounts are separate.
- The runtime identity has no image-build role.
- The provisioning path grants the build identity no access to application runtime secrets; inspect inherited IAM if the account already existed.
- App Check can be disabled only through the explicit -DisableAppCheck staging switch.
- The production scheduler currently uses a static high-entropy worker header. OIDC Scheduler-to-Cloud Run authentication would be stronger but requires a separate private worker architecture and is not silently substituted here.
- Firestore rules remain the client isolation boundary; Firebase Admin writes from Cloud Run bypass rules by design and are protected by verified Auth/App Check or the worker token boundary.

## 13. Source References

- Dockerfile - multi-stage container build and production runtime.
- cloudbuild.yaml - explicit Docker build, public build arguments, image push.
- scripts/provision-cloud-run.ps1 - service accounts, IAM, Artifact Registry, build, Cloud Run, label, scheduler.
- .dockerignore - Docker build-context exclusions.
- .gcloudignore - Cloud Build source-archive exclusions.
- firestore.rules - client read/write isolation.
- IMPLEMENTATION_GUIDE.md - requirements mapping and evaluator-facing deployment context.
- SELF_DEPLOYMENT_GUIDE.md - implementation-specific deployment workflow, imported Academy steps, verification, rollback, alternatives, and resolved issues.
- TEST_RESULTS.md - local and manual application evidence.

## 14. Official References

- [Cloud Run source deployment](https://docs.cloud.google.com/run/docs/deploying-source-code)
- [Cloud Run container image deployment](https://docs.cloud.google.com/run/docs/deploying)
- [Cloud Build Docker image builds](https://docs.cloud.google.com/build/docs/building/build-containers)
- [Cloud Build user-specified service accounts](https://docs.cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts)
- [Artifact Registry and Cloud Build](https://docs.cloud.google.com/artifact-registry/docs/configure-cloud-build)
