# Cloud Implementation Runbook

The current implementation topology is shown in [ARCHITECTURE.svg](ARCHITECTURE.svg). Use it together with this runbook to distinguish Firebase browser configuration, Cloud Run runtime configuration, Secret Manager values, Firestore rules, and the private Scheduler retention path.

**Application:** Personal Gemini Journal  
**Programme:** Google Cloud Gen AI Academy APAC Edition, Cohort 3  
**Target project:** `gen-lang-client-0752053463`  
**Target region:** `asia-southeast1`  
**Primary release path:** Cloud Build -> Artifact Registry -> Cloud Run  
**Document status:** Active implementation record; the App Check-enabled Cloud Run release is deployed. The retention index is ready, the protected scheduler path returns HTTP 200, and both Cloud Run hostnames return HTTP 200 for the shell and health endpoint. Authenticated browser App Check success/rejection and controlled due-record redaction remain explicit evidence gates.

This is the actual deployment record for this repository, not a generic tutorial. Every cloud action, delay, error, decision, and verification result belongs in the checklist or execution log. Secret values must never be written here.

## 1. Master Checklist

### Workstation and identity

- [x] Firebase CLI is installed: version `15.28.2`.
- [x] Firebase CLI can list the target project.
- [x] Firebase project context points to `gen-lang-client-0752053463`.
- [x] Google Cloud CLI archive `583.0.0` downloaded from Google's official archive.
- [x] Google Cloud CLI archive SHA-256 verified before extraction.
- [x] Portable Google Cloud CLI extracted with bundled Python.
- [x] `gcloud auth login` completed for the deployment operator.
- [x] `gcloud projects describe` succeeds for the target project.
- [x] Billing and required IAM permissions confirmed.

### Firebase and public browser configuration

- [x] Target Firebase project discovered: `gen-lang-client-0752053463`.
- [x] Firebase web app discovered: `ai-studio-applet-webapp`.
- [x] Firebase web app ID discovered: `1:709422088585:web:9d2bd6ac612d7f455de158`.
- [x] Public SDK configuration retrieved with `firebase apps:sdkconfig WEB`.
- [x] Production reCAPTCHA Enterprise site key supplied to the App Check-enabled Cloud Build and Cloud Run deployment.
- [x] Firebase browser Auth persistence is explicitly configured as `browserLocalPersistence`; no custom application session cookie is deployed.
- [x] Firebase App Check Web-app registration and allowed-domain configuration independently confirmed in the Firebase Console.
- [x] Firebase Google provider enabled and authorized domain configured.
- [x] Firestore rules deployed to the target project.
- [x] Retention collection-group index is ready in the target project.

### Secret Manager

- [x] `GEMINI_API_KEY` created or confirmed in Secret Manager.
- [x] `DELETION_HMAC_KEY` created or confirmed in Secret Manager.
- [x] `RETENTION_WORKER_TOKEN` created or confirmed in Secret Manager.
- [x] Runtime service account has `roles/secretmanager.secretAccessor` only on those three secrets.
- [x] Secret values are not present in Dockerfile, Cloud Build substitutions, image layers, repository files, or this runbook.

### Build and Cloud Run resources

- [x] Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Firestore, and Scheduler APIs enabled.
- [x] Dedicated runtime service account `personal-gemini-journal-run` created or confirmed.
- [x] Dedicated build service account `personal-gemini-journal-build` created or confirmed.
- [x] Artifact Registry repository `cloud-run-images` created or confirmed.
- [x] Cloud Build produces an immutable release-tagged image.
- [x] Cloud Run deploys the exact release image with the dedicated runtime identity.
- [x] Required label `dev-tutorial=cloud-run-ai-challenge` applied.
- [x] Cloud Run URL and image digest recorded below.

### Retention scheduler and live verification

- [x] Scheduler job `personal-gemini-journal-retention` created or updated.
- [x] Scheduler calls `/internal/retention/redact` with the protected worker token.
- [x] `/health` returns HTTP 200 on the current staging revision.
- [x] Live Google Sign-In succeeds.
- [ ] Live App Check succeeds for ordinary requests and rejects missing/invalid App Check when enforced.
- [x] Entry, reply, Privacy Guardian, audit, integrity, calendar, and deletion flows pass.
- [x] Deleted entries disappear from the UI while audit records remain.
- [ ] Due retention records replace `content`, `reflection`, `summary`, and conversation `text` with `Deleted`, remove sensitive derived metadata, preserve minimal integrity/lifecycle metadata, and emit `entry_redacted`; no controlled due record has yet been run in staging.
- [x] Cloud Run revision and Scheduler evidence recorded below.
- [x] Live second-account Firestore owner-isolation check recorded below; deployed rules and local emulator evidence already pass.

## 2. Discovered Configuration

The following values were discovered without writing credentials to the repository:

| Item | Actual result |
| --- | --- |
| Firebase project | `gen-lang-client-0752053463` |
| Firebase project display name | `Default Gemini Project` |
| Firebase web app | `ai-studio-applet-webapp` |
| Firebase web app ID | `1:709422088585:web:9d2bd6ac612d7f455de158` |
| Firebase storage bucket | `gen-lang-client-0752053463.firebasestorage.app` |
| Firebase auth domain | `gen-lang-client-0752053463.firebaseapp.com` |
| Canonical staging Cloud Run URL | `https://personal-gemini-journal-eazyegerma-as.a.run.app` |
| Alternate staging Cloud Run URL | `https://personal-gemini-journal-709422088585.asia-southeast1.run.app` |
| Current Cloud Run revision | `personal-gemini-journal-00018-qqb` |
| Current image tag | `release-20260904-integrity-counts` |
| Current image digest | `sha256:136da7af3d052ae1256b530ff509980e0929d529426849210e944d5ead013910` |
| App Check | Cloud Run enforcement enabled; live browser token validation pending |
| Staging scheduler | Enabled; `0 2 * * *` UTC |
| Current runtime secret versions | `GEMINI_API_KEY` v2, `DELETION_HMAC_KEY` v2, `RETENTION_WORKER_TOKEN` v3; superseded versions disabled |
| Retention index | `retentionEntries.redactAt`, collection-group ascending; `READY` |
| Firebase CLI project listing | PASS |
| Firestore location in repository config | `asia-southeast1` |
| Cloud Run service | `personal-gemini-journal` |
| Runtime service account | `personal-gemini-journal-run@gen-lang-client-0752053463.iam.gserviceaccount.com` |
| Build service account | `personal-gemini-journal-build@gen-lang-client-0752053463.iam.gserviceaccount.com` |
| Artifact Registry repository | `cloud-run-images` |
| Scheduler job | `personal-gemini-journal-retention` |

Firebase browser configuration is intentionally public because Vite embeds it in the browser bundle. It must still be restricted by Firebase Auth, App Check, authorized domains, and Firestore rules. It is not interchangeable with the Gemini key or server credentials.

## 3. Secret Source Decision

The local file `server/.env` exists and currently contains a `GEMINI_API_KEY` value. A presence/length-only audit found:

| Variable | Local result | Action |
| --- | --- | --- |
| `GEMINI_API_KEY` | Present; length recorded locally but value not displayed | Uploaded as exact bytes to Secret Manager v2 and bound at Cloud Run runtime |
| `DELETION_HMAC_KEY` | Missing | Generated cryptographically and uploaded as exact bytes to Secret Manager v2 |
| `RETENTION_WORKER_TOKEN` | Missing | Generated cryptographically, uploaded as exact bytes to Secret Manager v3, and synchronized with Scheduler |

The local `server/.env` must not be uploaded as a build context or copied into the image. The Docker and Cloud Build ignore rules already exclude it. If the Gemini key was ever committed or shared, revoke it before using a replacement.

Create or update secrets using protected local files or an equivalent secret-entry mechanism. Do not put values directly in command history:

~~~powershell
gcloud secrets create GEMINI_API_KEY --replication-policy=automatic --project gen-lang-client-0752053463
gcloud secrets create DELETION_HMAC_KEY --replication-policy=automatic --project gen-lang-client-0752053463
gcloud secrets create RETENTION_WORKER_TOKEN --replication-policy=automatic --project gen-lang-client-0752053463
gcloud secrets versions add GEMINI_API_KEY --data-file=PATH_TO_PROTECTED_GEMINI_KEY_FILE --project gen-lang-client-0752053463
gcloud secrets versions add DELETION_HMAC_KEY --data-file=PATH_TO_PROTECTED_HMAC_FILE --project gen-lang-client-0752053463
gcloud secrets versions add RETENTION_WORKER_TOKEN --data-file=PATH_TO_PROTECTED_WORKER_TOKEN_FILE --project gen-lang-client-0752053463
~~~

The repository provisioning script does not create or generate secret values. That is deliberate: secret material belongs to the operator's protected environment, not application source control.

## 4. Implemented Provisioning Path

The actual implementation is in [scripts/provision-cloud-run.ps1](scripts/provision-cloud-run.ps1). It performs these operations in order:

1. Validates `RETENTION_WORKER_TOKEN` and all six Firebase browser values without printing them.
2. Requires a production reCAPTCHA Enterprise site key unless the explicit `-DisableAppCheck` staging switch is used.
3. Enables the required Google Cloud APIs.
4. Creates or confirms the dedicated build and runtime service accounts.
5. Creates or confirms the Artifact Registry Docker repository.
6. Grants the build identity repository-scoped image-write access.
7. Grants the runtime identity Firestore access and secret accessor access only to the three named secrets.
8. Runs [cloudbuild.yaml](cloudbuild.yaml) with public browser values only.
9. Deploys the immutable image to Cloud Run with the dedicated runtime identity and Secret Manager bindings.
10. Applies the required cohort label.
11. Creates or updates the daily retention scheduler.

The script does not grant the build identity access to runtime secret values. Existing inherited project IAM must be inspected if the service account names already exist.

## 5. Authentication and Environment Setup

The original staging operator used a portable Google Cloud CLI. The host-specific installation path is intentionally omitted from this repository. Use `gcloud` from `PATH`, or set `PATH_TO_GCLOUD_BIN` to the `bin` directory of a portable SDK first:

~~~powershell
$gcloud = (Get-Command gcloud -ErrorAction Stop).Source
& $gcloud --version
& $gcloud auth login
& $gcloud config set project gen-lang-client-0752053463
~~~

For the current PowerShell process, a portable SDK can be selected explicitly:

~~~powershell
$env:PATH = "PATH_TO_GCLOUD_BIN;$env:PATH"
gcloud --version
gcloud auth list --filter=status:ACTIVE
gcloud config set project gen-lang-client-0752053463
~~~

The authentication attempt used `gcloud auth login --no-launch-browser`; browser verification completed for the deployment operator. The active project probe passed before resource provisioning.

## 6. Production Build Inputs

Set these in the protected deployment session from Firebase Console or `firebase apps:sdkconfig WEB`. Never put them in this document:

~~~powershell
$env:VITE_FIREBASE_API_KEY = "PUBLIC_FIREBASE_WEB_API_KEY"
$env:VITE_FIREBASE_AUTH_DOMAIN = "gen-lang-client-0752053463.firebaseapp.com"
$env:VITE_FIREBASE_PROJECT_ID = "gen-lang-client-0752053463"
$env:VITE_FIREBASE_STORAGE_BUCKET = "gen-lang-client-0752053463.firebasestorage.app"
$env:VITE_FIREBASE_MESSAGING_SENDER_ID = "709422088585"
$env:VITE_FIREBASE_APP_ID = "1:709422088585:web:9d2bd6ac612d7f455de158"
$env:VITE_RECAPTCHA_ENTERPRISE_SITE_KEY = "PRODUCTION_RECAPTCHA_ENTERPRISE_SITE_KEY"
~~~

The provisioning script enforces these safety rules:

- `VITE_FIREBASE_PROJECT_ID` must equal `-ProjectId`.
- `VITE_USE_EMULATORS` is always set to `false` for the release build.
- App Check is enabled by default and requires a non-empty site key.
- The API base is empty so one Cloud Run service serves both the SPA and `/api` routes.
- Values containing commas are rejected because the script passes substitutions to Cloud Build.

## 7. Release Command

After authentication, secret creation, and production App Check domain registration, run from the repository root:

~~~powershell
$env:RETENTION_WORKER_TOKEN = (Get-Content "PATH_TO_PROTECTED_WORKER_TOKEN_FILE" -Raw).Trim()
.\scripts\provision-cloud-run.ps1 `
  -ProjectId gen-lang-client-0752053463 `
  -Region asia-southeast1 `
  -ServiceName personal-gemini-journal `
  -ServiceAccountName personal-gemini-journal-run `
  -BuildServiceAccountName personal-gemini-journal-build `
  -ArtifactRepository cloud-run-images
~~~

The script generates an immutable UTC release tag if `-ImageTag` is omitted. For a controlled promotion, pass an explicit lower-case tag such as `release-20260903-220000`.

The first staging sequence used `-DisableAppCheck` because the production site key was not yet available. If both URLs will be used, register both `personal-gemini-journal-eazyegerma-as.a.run.app` and `personal-gemini-journal-709422088585.asia-southeast1.run.app` in Firebase Auth Authorized Domains and App Check's allowed domains. Set the real site key in the protected deployment session and rerun without `-DisableAppCheck`. A staging deployment with App Check disabled must not be treated as the final security posture.

## 8. Post-Deployment Verification

Record command outputs without exposing secret values:

~~~powershell
$service = gcloud run services describe personal-gemini-journal --project gen-lang-client-0752053463 --region asia-southeast1 --format="value(status.url)"
Invoke-WebRequest "$service/health" | Select-Object StatusCode, Content
gcloud run services describe personal-gemini-journal --project gen-lang-client-0752053463 --region asia-southeast1 --format="yaml(metadata.labels,spec.template.spec.serviceAccountName,spec.template.spec.containers[0].image)"
gcloud scheduler jobs describe personal-gemini-journal-retention --project gen-lang-client-0752053463 --location asia-southeast1 --format="yaml(name,state,httpTarget.uri,schedule)"
~~~

The controlled application verification sequence is:

1. Complete Google Sign-In.
2. Create a plain entry and verify summary, topics, category, reflection, audit event, and calendar marker.
3. Create a related reply and verify category linkage.
4. Trigger Privacy Guardian on entry and reply; verify Redact and Send as-is close the modal immediately.
5. Verify the active SHA-256 chain.
6. Delete one entry; confirm it disappears from the journal and calendar while audit activity remains.
7. Test all-journal deletion with a controlled account.
8. Verify ordinary requests with valid Auth and App Check tokens succeed.
9. Verify missing or invalid App Check is rejected when enforcement is enabled.
10. Confirm Firestore cross-user reads and client writes remain denied.
11. Confirm the Scheduler target, schedule, and successful retention execution.
12. Confirm a due record remains in backend-only retention storage with `content`, `reflection`, `summary`, and conversation `text` replaced by `Deleted`, sensitive derived metadata removed, minimal hashes/timestamps/deletion metadata preserved, and an `entry_redacted` audit event written.

## 9. Rollback and Failure Handling

Cloud Run revisions are immutable. If a release fails, preserve its image and logs, identify the prior revision, and route traffic back:

~~~powershell
gcloud run revisions list --service personal-gemini-journal --project gen-lang-client-0752053463 --region asia-southeast1
gcloud run services update-traffic personal-gemini-journal --project gen-lang-client-0752053463 --region asia-southeast1 --to-revisions PREVIOUS_REVISION=100
~~~

Do not rotate or delete a production secret merely because a deployment fails. First inspect the Cloud Run revision event, Secret Manager binding, runtime identity IAM, image digest, and App Check configuration. Rotate a secret only when compromise or incorrect material is confirmed.

## 10. Execution Log

| Date/time | Phase | Result | Actual evidence or error | Next action |
| --- | --- | --- | --- | --- |
| 2026-09-03 | Firebase CLI discovery | PASS | Firebase CLI `15.28.2` listed the target project and returned one web app | Use the discovered web app configuration as public build input |
| 2026-09-03 | Firebase public SDK config | PASS | `firebase apps:sdkconfig WEB` returned project/app ID, auth domain, storage bucket, sender ID, and public API key | Keep values build-time only |
| 2026-09-03 | Local secret audit | PARTIAL | `server/.env` contains `GEMINI_API_KEY`; `DELETION_HMAC_KEY` and `RETENTION_WORKER_TOKEN` are absent; no values were printed | Add Gemini key securely and generate the two missing values |
| 2026-09-03 | Google Cloud CLI WinGet install | BLOCKED / WORKAROUND | WinGet downloaded and hash-verified the installer, but the administrator handoff remained stuck | Use the official versioned portable archive |
| 2026-09-03 | Google Cloud CLI archive | PASS | Version `583.0.0` bundled-Python archive SHA-256 matched Google's published checksum; `gcloud --version` executed successfully | Use the portable binary path |
| 2026-09-03 | Google Cloud authentication | PASS | `gcloud auth login --no-launch-browser` completed; active operator is configured and project probe passed | Continue with staged deployment evidence |
| 2026-09-03 | App Check deployment first attempt | BLOCKED / FIXED | Windows PowerShell resolved the `gcloud.ps1` wrapper; an informational `Encryption: Google-managed key` line from Artifact Registry was treated as a terminating native-command error before Cloud Build; no new image or Cloud Run revision was created | The provisioning script now prefers `gcloud.cmd` on Windows; rerun with the same protected environment without `-DisableAppCheck` |
| 2026-09-03 | Windows native stderr handling | FIXED | `gcloud.cmd` also emitted the benign Artifact Registry encryption-status line through stderr; Windows PowerShell 5.1 stopped at the resource probe before Cloud Build; no new image or Cloud Run revision was created | The provisioning script now temporarily preserves `Continue` while invoking gcloud and uses the process exit code for success/failure; rerun the App Check-enabled release |
| 2026-09-03 | API/IAM provisioning | PASS | Required APIs enabled; dedicated build/runtime service accounts created; Artifact Registry repository created; runtime IAM bindings applied | Inspect inherited IAM before production if identities are reused |
| 2026-09-03 | Secret Manager provisioning | PASS | `GEMINI_API_KEY`, `DELETION_HMAC_KEY`, and `RETENTION_WORKER_TOKEN` were created without logging values; the initial worker version was later rotated | Keep values runtime-only |
| 2026-09-03 | Cloud Build image | PASS | Cloud Build `56dfb817-0a67-4574-bc0d-5424bfe4b610` succeeded; release tag `release-20260903-034613`; digest `sha256:5ca2239bb068e890c3bf29023479f99825d7f4c3d156cf1713d8bb737d368c53` | Promote the same Dockerfile through the final App Check-enabled build |
| 2026-09-03 | Initial staging Cloud Run deployment | PASS / STAGING ONLY | Revision `personal-gemini-journal-00002-dzg` served 100% traffic with the dedicated runtime identity; App Check disabled pending site-key registration | Continue staging verification without claiming production readiness |
| 2026-09-03 | Scheduler token output exposure | FIXED | Initial scheduler create response echoed the configured worker header; token was immediately rotated to a new Secret Manager version and scheduler updated with `--update-headers`; script now suppresses scheduler response output | Verify future runs do not print scheduler headers |
| 2026-09-03 | Secret byte normalization | FIXED | PowerShell pipeline uploads had appended newlines, causing exact worker-token comparison to reject the valid token; all three secrets were re-uploaded with exact UTF-8 bytes and superseded versions were disabled | Redeploy the corrected secret versions |
| 2026-09-03 | Pre-CORS Cloud Run configuration redeploy | PASS / HISTORICAL | Revision `personal-gemini-journal-00005-d86` used image digest `sha256:800ff4263fc63154fd9f9a825349d05aa107d8886bd8b35cf157e9d5dbbf6b70`, dedicated runtime identity, and secret versions v2/v2/v3 before the alternate-host CORS fix | Superseded by the CORS fix revision recorded below |
| 2026-09-03 | Live `/health` probe | PASS | `/health` returned HTTP 200 and `/` returned HTTP 200 on the current revision; `/health` is the Cloud Run probe path while `/healthz` remains supported locally | Continue protected endpoint verification |
| 2026-09-03 | Scheduler JSON body serialization | FIXED | Windows `.cmd` argument handling stripped the quotes from the JSON body and produced `{limit:50}` with HTTP `400`; escaped JSON quotes are now used in the provisioning script and live Scheduler job | Keep the escaped form in future Windows provisioning changes |
| 2026-09-03 | Retention index deployment | FIXED / PASS | Initial composite-index definition was rejected as unnecessary; corrected `fieldOverrides` definition deployed successfully, and Firestore reports `retentionEntries.redactAt` collection-group index state `READY` | Verify the protected worker and Scheduler path |
| 2026-09-03 | Live retention worker authorization | PASS | Invalid worker token returned `401`; valid token returned `200` with `{"processed":0,"redacted":0,"skipped":0}` | Use a controlled due record for transformation evidence |
| 2026-09-03 | Live Scheduler invocation | PASS | Enabled Scheduler job `personal-gemini-journal-retention` manually dispatched `POST /internal/retention/redact`; Cloud Run request log returned HTTP `200` | Monitor the scheduled daily run and retain a due-record fixture for final evidence |
| 2026-09-03 | Firestore rules and index release | PASS | Firebase deployed `firestore.rules` and `firestore.indexes.json` to the `(default)` database; the retention index reached `READY` after the documented build delay | Preserve the deployed files with the application release |
| 2026-09-03 | Emulator verification environment | BLOCKED / WORKAROUND | The first emulator command stopped because the selected Java 11 runtime is below the current Firebase CLI requirement of Java 21 | Use the installed Java 26 runtime for the verification command |
| 2026-09-03 | Emulator verification rerun | PASS | With Java 26 selected, the server suite completed with `34 passing` and `2 pending`; the pending specs are the live Gemini authenticity check and the named route-level idempotency specification | Keep the pending specs visible; do not count them as passing |
| 2026-09-03 | Identity Platform configuration probe | BLOCKED / NO CHANGE | Read-only API inspection returned HTTP `403` for the current deployment operator; Firebase Google-provider and Authorized Domain state therefore remain unclaimed until checked in Firebase Console | Verify the provider and add the exact Cloud Run hostname in Firebase Console |
| 2026-09-03 | Alternate-host asset failure | FIXED | The alternate Cloud Run hostname returned HTML `200` but JavaScript and CSS returned `500` because the CORS allowlist rejected the same-origin Cloud Run host | Deploy the same-origin CORS fix without changing API authorization |
| 2026-09-03 | CORS fix build and deployment | PASS / STAGING ONLY | Cloud Build `89d4c861-3eaa-4997-b03a-5fc5d339603b` produced digest `sha256:9b486ad8c30d4e091b8ba38bd635dbfd75bb32857a880e2990393751db6e2596`; revision `personal-gemini-journal-00008-crl` serves 100% traffic | Complete final App Check and authenticated browser verification |
| 2026-09-03 | Browser verification of alternate host | PASS / STAGING ONLY | Supplied URL loaded the `Personal Journal` sign-in screen; JS/CSS assets returned `200` and browser console error logs were empty | Verify Firebase Authorized Domains and Google Sign-In before production use |
| 2026-09-03 | Warning-fix Cloud Build | PASS | Cloud Build `4bc39098-bcb2-4edb-9af7-e9c639e4a8de` produced image tag `release-20260903-warningsfix` with digest `sha256:7e4273412b35035df2e81063c70a9fe0c6749bcad158ce54a188e70be712ee76`; build emitted no Docker BuildKit or Vite bundle warnings | Deploy the immutable image with the dedicated runtime identity |
| 2026-09-03 | Warning-fix Cloud Run redeploy | PASS / STAGING ONLY | Revision `personal-gemini-journal-00009-7br` was deployed, then revision `personal-gemini-journal-00010-zvr` was created by the required label update and now serves 100% traffic; App Check remains disabled by explicit staging switch | Complete production App Check and authenticated browser verification |
| 2026-09-03 | Post-redeploy live verification | PASS / STAGING ONLY | Both hostnames returned `/health` and `/` HTTP 200 and all split assets returned HTTP 200; invalid worker token returned `401`; valid worker request returned `200` with `processed:0`, `redacted:0`, `skipped:0`; Scheduler is enabled and targets the canonical URL | Use a controlled due record for final redaction evidence |
| 2026-09-03 | App Check-enabled Cloud Build | PASS | Cloud Build `17d6879b-d169-4f6b-bc32-63ff3e9aa2c3` completed in `3M26S` and produced image tag `release-20260903-appcheck` with digest `sha256:ebae5f347a352662f408f13a7998a320efb3db594c001c93e5adfa53121486ac` | Complete live authenticated App Check success and rejection tests |
| 2026-09-03 | App Check-enabled Cloud Run deployment | PASS | Revision `personal-gemini-journal-00011-9tv` was deployed, then revision `personal-gemini-journal-00012-lvh` was created by the required label update; revision `00012-lvh` serves 100% traffic with `ENFORCE_APP_CHECK=true` and the dedicated runtime identity | Complete authenticated browser verification |
| 2026-09-04 | Integrity-count UI release | PASS | Revision `personal-gemini-journal-00018-qqb` serves image tag `release-20260904-integrity-counts` with digest `sha256:136da7af3d052ae1256b530ff509980e0929d529426849210e944d5ead013910`, `ENFORCE_APP_CHECK=true`, the dedicated runtime identity, the required cohort label, and 100% traffic | Complete live App Check token and controlled retention evidence |
| 2026-09-03 | App Check release post-deployment verification | PASS / STAGING | Current service describes the App Check flag as `true`, references all three runtime secrets, both hostnames return HTTP 200 for `/health` and `/`, and the enabled Scheduler targets the canonical retention route | Record valid App Check browser request, missing/invalid-token `401`, and controlled `entry_redacted` evidence |

## 11. Security Decisions

- Runtime secrets are injected by Cloud Run from Secret Manager and are never Docker build arguments.
- Public Firebase browser values are separated from server secrets and embedded only in the Vite build.
- Build and runtime service accounts are separate.
- Artifact Registry write access is repository-scoped for the build identity.
- Runtime Secret Manager access is limited to the three named secrets.
- App Check is production-enforced by default; disabling it requires an explicit staging switch.
- The retention scheduler uses the protected worker token and does not receive Gemini or HMAC secrets.
- Firestore rules protect client isolation; Admin SDK writes are controlled by verified Auth/App Check or the worker-token boundary.
- Local service-account key files and `.env` files remain excluded from Docker/Cloud Build contexts.

## 12. Official References

- [Install Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install-sdk)
- [Install from versioned archives](https://docs.cloud.google.com/sdk/docs/downloads-versioned-archives)
- [Deploy container images to Cloud Run](https://docs.cloud.google.com/run/docs/deploying)
- [Create and access Secret Manager secrets](https://docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)
- [Cloud Build user-specified service accounts](https://docs.cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts)
