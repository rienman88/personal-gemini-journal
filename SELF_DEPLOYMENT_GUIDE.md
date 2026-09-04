# Personal Gemini Journal - Self-Deployment Guide

**Programme:** Google Cloud Gen AI Academy APAC Edition, Cohort 3  
**Deployment model:** Docker image -> Cloud Build -> Artifact Registry -> Cloud Run  
**Status:** Reproducible deployment procedure for this repository; staging was executed on 2026-09-03.

This is an implementation-specific guide. It records the commands, project defaults, security boundaries, external console actions, verification steps, alternatives, and deployment issues encountered while deploying this application. It is not a generic Cloud Run tutorial.

## 1. Current implementation

The application includes Firebase Google Sign-In, explicit Firebase browser-local persistence for trusted-device sessions, owner-isolated Firestore records, Gemini multi-turn analysis, Privacy Guardian interception, RAW/DERIVED data separation, category clustering, Calendar v1, audit activity, SHA-256 integrity verification, idempotency, rate and token budgets, privacy-safe deletion, 30-day backend retention/redaction, App Check, a dedicated Cloud Run runtime identity, and a protected retention scheduler. It does not create a custom application session cookie or automatic idle logout; shared or public devices require explicit Sign out.

Use the repository's [architecture diagram](docs/ARCHITECTURE.svg) while following this guide. It maps each deployment component to the actual runtime path and distinguishes browser reads, Cloud Run/Admin SDK writes, Gemini calls, Secret Manager access, and the private retention worker.

The deployed staging reference is:

| Item | Value |
| --- | --- |
| Google Cloud project | gen-lang-client-0752053463 |
| Region | asia-southeast1 |
| Cloud Run service | personal-gemini-journal |
| Canonical URL | https://personal-gemini-journal-eazyegerma-as.a.run.app |
| Alternate URL | https://personal-gemini-journal-709422088585.asia-southeast1.run.app |
| Revision | personal-gemini-journal-00018-qqb |
| Image tag | release-20260904-integrity-counts |
| Runtime identity | personal-gemini-journal-run@gen-lang-client-0752053463.iam.gserviceaccount.com |
| Build identity | personal-gemini-journal-build@gen-lang-client-0752053463.iam.gserviceaccount.com |
| Artifact Registry repository | cloud-run-images |
| Retention scheduler | personal-gemini-journal-retention, 0 2 * * * UTC |
| App Check | Cloud Run enforcement enabled; live browser token validation remains an operator check |

Do not copy the reference project's secrets or public configuration into another project. Discover values from the target Firebase project and create fresh secrets.

## 2. Deployment checklist

- [ ] Confirm the Google Cloud project, billing, region, and deployment operator permissions.
- [ ] Accept Firebase terms and enable Google Sign-In in the target Firebase project.
- [ ] Create the Firebase web app and collect its six public browser values.
- [ ] Add both Cloud Run hostnames and localhost to Firebase Authentication Authorized Domains.
- [ ] Register a reCAPTCHA Enterprise web key for Firebase App Check.
- [ ] Create the three Secret Manager secrets with exact UTF-8 values and no trailing newline.
- [ ] Deploy Firestore rules and indexes.
- [ ] Run the staging deployment with -DisableAppCheck only if the App Check key is not ready.
- [ ] Verify /, /health, assets, authentication, journal flows, deletion, integrity, and worker authorization.
- [ ] Run the retention worker against a controlled due record in a dedicated test account or emulator.
- [ ] Run the final deployment without -DisableAppCheck and verify missing/invalid App Check rejection.
- [ ] Record the final revision, image digest, URL, label, test evidence, repository URL, and Academy submission evidence.

The full feature-by-feature manual matrix is in [TEST_RESULTS.md](TEST_RESULTS.md). Do not use a real user's journal for destructive deletion or retention tests.

## 3. Imported Academy workflow

The source requirements are the [Google Cloud Gen AI Academy APAC Cohort 3 event page](https://hack2skill.com/event/apac-genaiacademy?tab=cohort3&utm_source=hack2skill&utm_medium=homepage) and the [Cloud Run AI challenge codelab](https://codelabs.developers.google.com/codelabs/cloud-run/cloud-run-ai-challenge). The current project is for this Academy cohort, not Devpost.

1. Open Google AI Studio and create the application workspace.
2. Paste the current CONSTITUTION.md as the Custom Instructions. It defines the threat model, server-side Gemini secret boundary, Firestore owner isolation, App Check, deletion lifecycle, testing, and documentation rules.
3. Use the authenticated Gemini/Firestore application prompt from [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md), then review generated code against this repository rather than accepting generated changes blindly.
4. Accept the Firebase setup terms when AI Studio presents the Firebase setup prompt. Without acceptance, Auth and Firestore setup can remain incomplete.
5. Test sign-in, a plain entry, a multi-turn reply, sign-out/re-authentication, PII interception, deletion, integrity, audit activity, calendar behavior, and failure fallback.
6. Publish the app from AI Studio if using its publishing flow, then identify the resulting Cloud Run service. This repository's repeatable deployment path is the Docker/Cloud Build path below.
7. Apply the required Cloud Run label dev-tutorial=cloud-run-ai-challenge.
8. Run [GITHUB_PUBLICATION_CHECKLIST.md](GITHUB_PUBLICATION_CHECKLIST.md), then publish the source repository to GitHub or GitLab without .env, service-account keys, API secrets, build output, or emulator data.
9. Prepare a walkthrough or demo post showing the unique features and use #AccelerateAIwithCloudRun where required by the cohort submission instructions.
10. Submit the Cloud Run URL, repository URL, demo evidence, service/project information, and other requested fields through the Academy programme dashboard. The event page is the source of truth for deadlines and submission mechanics.

Optional Maps, admin RBAC, Slack/Discord/email, vector search, and other integrations are not part of this version. Adding one requires a separate threat model, secret, access-control, test, and documentation change.

## 4. Workstation setup

Use Google Cloud Shell, an installed Google Cloud CLI, or the portable archive. The portable Windows archive was used for the actual staging deployment after the administrator handoff from the WinGet installer stalled. Verify the archive checksum before extraction if using the portable path.

~~~powershell
gcloud auth login
gcloud config set project gen-lang-client-0752053463
gcloud projects describe gen-lang-client-0752053463
firebase login
firebase use gen-lang-client-0752053463
docker version
node --version
~~~

The current Firebase CLI is sensitive to the selected Java runtime when starting emulators. The first local emulator attempt selected Java 11 and stopped; selecting the installed Java 26 runtime produced 34 passing tests and 2 intentionally pending tests. Java 21 or newer is required by the current Firebase CLI.

On Windows PowerShell, select an installed JDK before running the emulator-backed suite. Replace the path if the JDK is installed elsewhere:

~~~powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-26"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
npx --yes firebase-tools@latest emulators:exec --only firestore,auth "npm test --prefix server"
~~~

Do not treat a direct `npm test --prefix server` invocation as the complete suite: the Firestore rules test requires the emulator host variables that `emulators:exec` supplies.

## 5. Firebase setup

Perform these actions in the target Firebase project:

1. Accept the Firebase terms.
2. Enable Firebase Authentication and the Google provider. Configure the support email if Firebase requests one.
3. Enable Cloud Firestore and use the repository's configured region where the target project permits it.
4. Create or select the Firebase web app.
5. Add the exact deployed hostnames to Authentication -> Settings -> Authorized domains:
   - localhost
   - personal-gemini-journal-eazyegerma-as.a.run.app
   - personal-gemini-journal-709422088585.asia-southeast1.run.app
6. Retrieve the browser configuration without treating it as a server secret:

~~~powershell
firebase apps:list --project gen-lang-client-0752053463
firebase apps:sdkconfig WEB --project gen-lang-client-0752053463
~~~

Pass these six values to the provisioning script: apiKey, authDomain, projectId, storageBucket, messagingSenderId, and appId. The browser API key is public Firebase configuration, but it must still be restricted in the Google/Firebase consoles.

## 6. Firestore rules and indexes

Deploy the checked-in rules and index definitions before starting application verification:

~~~powershell
firebase deploy --only firestore:rules,firestore:indexes --project gen-lang-client-0752053463
gcloud firestore indexes composite list --project gen-lang-client-0752053463
~~~

The retention query uses a collection-group index on retentionEntries.redactAt. Wait until the index state is READY before testing a due-record redaction. An earlier deployment returned HTTP 500 until this index was created and ready; the checked-in firestore.indexes.json is the correction.

## 7. Secret Manager preparation

Create these server-only secrets:

| Secret | Purpose |
| --- | --- |
| GEMINI_API_KEY | Gemini server API credential |
| DELETION_HMAC_KEY | HMAC key for privacy-safe deletion actor identifiers |
| RETENTION_WORKER_TOKEN | Scheduler-to-worker authentication |

Create each secret once, then add a new version when rotating it:

~~~powershell
gcloud secrets create GEMINI_API_KEY --replication-policy=automatic --project gen-lang-client-0752053463
gcloud secrets create DELETION_HMAC_KEY --replication-policy=automatic --project gen-lang-client-0752053463
gcloud secrets create RETENTION_WORKER_TOKEN --replication-policy=automatic --project gen-lang-client-0752053463
gcloud secrets versions add GEMINI_API_KEY --data-file=PATH_TO_PROTECTED_GEMINI_FILE --project gen-lang-client-0752053463
gcloud secrets versions add DELETION_HMAC_KEY --data-file=PATH_TO_PROTECTED_HMAC_FILE --project gen-lang-client-0752053463
gcloud secrets versions add RETENTION_WORKER_TOKEN --data-file=PATH_TO_PROTECTED_WORKER_FILE --project gen-lang-client-0752053463
~~~

The protected files must contain exact UTF-8 bytes and no accidental newline. The provisioning script does not generate or print secrets. For the scheduler header, load the worker value into the current protected PowerShell session without putting the literal value in shell history:

~~~powershell
$env:RETENTION_WORKER_TOKEN = [IO.File]::ReadAllText("PATH_TO_PROTECTED_WORKER_FILE").Trim()
~~~

Never use echo, Write-Output, Docker ARG, Cloud Build substitutions, repository files, or this document for secret material. The runtime identity receives Secret Manager access only to the three named secrets.

## 8. Deploy with the repository implementation

The executable implementation is [scripts/provision-cloud-run.ps1](scripts/provision-cloud-run.ps1). It enables APIs, creates or confirms the build/runtime identities, creates or confirms Artifact Registry, applies least-privilege bindings, submits the Docker build, deploys the image with Secret Manager references, applies the cohort label, and creates or updates the protected daily Scheduler job.

### Staging deployment while App Check is not registered

Use this only for a temporary staging pass. It keeps Firebase Auth and all server controls active but disables App Check enforcement and frontend token acquisition:

~~~powershell
./scripts/provision-cloud-run.ps1 -ProjectId "gen-lang-client-0752053463" -Region "asia-southeast1" -DisableAppCheck -FirebaseApiKey "FIREBASE_WEB_API_KEY" -FirebaseAuthDomain "gen-lang-client-0752053463.firebaseapp.com" -FirebaseProjectId "gen-lang-client-0752053463" -FirebaseStorageBucket "gen-lang-client-0752053463.firebasestorage.app" -FirebaseMessagingSenderId "FIREBASE_SENDER_ID" -FirebaseAppId "FIREBASE_WEB_APP_ID" -ImageTag "release-YYYYMMDD-staging"
~~~

### Final App Check-enforced deployment

Register the reCAPTCHA Enterprise site key first, then omit -DisableAppCheck and provide the real site key. The script will refuse an enabled deployment without it:

~~~powershell
./scripts/provision-cloud-run.ps1 -ProjectId "gen-lang-client-0752053463" -Region "asia-southeast1" -RecaptchaEnterpriseSiteKey "RECAPTCHA_ENTERPRISE_SITE_KEY" -FirebaseApiKey "FIREBASE_WEB_API_KEY" -FirebaseAuthDomain "gen-lang-client-0752053463.firebaseapp.com" -FirebaseProjectId "gen-lang-client-0752053463" -FirebaseStorageBucket "gen-lang-client-0752053463.firebasestorage.app" -FirebaseMessagingSenderId "FIREBASE_SENDER_ID" -FirebaseAppId "FIREBASE_WEB_APP_ID" -ImageTag "release-YYYYMMDD-appcheck"
~~~

The six Firebase values may instead be set as VITE_FIREBASE_* environment variables. The site key may be supplied as VITE_RECAPTCHA_ENTERPRISE_SITE_KEY. Do not set VITE_API_BASE_URL for this single-origin deployment; the browser uses same-origin /api.

## 9. Post-deployment verification

Run these checks against the URL printed by Cloud Run:

~~~powershell
$url = "https://YOUR_CLOUD_RUN_HOST"
Invoke-WebRequest "$url/" -UseBasicParsing
Invoke-WebRequest "$url/health" -UseBasicParsing
gcloud run services describe personal-gemini-journal --region asia-southeast1 --project gen-lang-client-0752053463
gcloud scheduler jobs run personal-gemini-journal-retention --location asia-southeast1 --project gen-lang-client-0752053463
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="personal-gemini-journal"' --limit=20 --project gen-lang-client-0752053463
~~~

In a browser, confirm the sign-in screen loads, JavaScript and CSS assets return 200, and the console has no application errors. Then execute the manual matrix in [TEST_RESULTS.md](TEST_RESULTS.md), using a dedicated test account for deletion and retention. The current staging results include /, /health, asset loading on both Cloud Run hostnames, invalid worker token 401, valid worker 200, and a manual Scheduler 200.

For the final revision, explicitly verify:

- Google Sign-In succeeds on the exact production hostname.
- A missing or invalid X-Firebase-AppCheck token returns 401 on an authenticated API request.
- A valid Auth plus App Check request reaches the journal route.
- One controlled due retention record changes its text fields to Deleted and creates entry_redacted without deleting audit or integrity metadata.
- The Cloud Run revision uses the dedicated runtime identity and the required label.

## 10. Rollback

Keep the previous immutable revision and image digest until the final smoke test passes. If a release is faulty, route traffic back to the known-good revision:

~~~powershell
gcloud run services update-traffic personal-gemini-journal --to-revisions KNOWN_GOOD_REVISION=100 --region asia-southeast1 --project gen-lang-client-0752053463
~~~

Do not delete the previous image or disable Firestore rules to work around an application failure. Investigate Cloud Run logs, correct the source, build a new immutable tag, and redeploy.

## 11. Actual deployment issues and resolutions

| Issue | Impact | Resolution |
| --- | --- | --- |
| WinGet gcloud installer administrator handoff stalled | CLI installation did not complete | Used Google's portable gcloud archive after checksum verification |
| Firebase emulator selected Java 11 | Emulator startup stopped | Selected installed Java 26; current CLI requires Java 21 or newer |
| Secret uploads included newline bytes | Runtime credentials did not match | Re-uploaded exact UTF-8 bytes as new Secret Manager versions |
| Scheduler update used unsupported --headers syntax | Scheduler update failed | Script now uses --update-headers |
| Windows command parsing stripped JSON quotes | Scheduler sent {limit:50} and returned 400 | Script escapes the JSON message body for the Windows gcloud wrapper |
| Retention query had no collection-group index | Worker returned HTTP 500 | Added the checked-in field override and waited for READY |
| Alternate Cloud Run host rejected its own assets | HTML returned 200, JS/CSS returned 500 | CORS now allows same-origin requests by comparing Origin with Host; the original fix was verified on revision 00008-crl and is superseded by the current App Check-enabled revision 00018-qqb |

These were resolved implementation defects, not reasons to bypass security controls. The remaining operator gates are evidence tasks: Firebase Google-provider/Authorized-Domain confirmation, Firebase App Check Web-app registration confirmation, valid and invalid live App Check request testing, controlled due-record execution, billing/IAM review, and Academy submission.

## 12. Alternatives

- **Google Cloud Shell:** avoids local gcloud and Java installation; run the same Firebase, gcloud, and PowerShell-equivalent commands where supported.
- **Direct local Docker push:** build with docker build, authenticate Docker to Artifact Registry, push an immutable tag, then run gcloud run deploy --image ... --service-account ... --set-secrets .... This is valid but bypasses the repository's separate Cloud Build identity and should only be used as a controlled alternative.
- **Cloud Run source deployment:** convenient for simple apps, but not the chosen path because it hides the explicit Docker image boundary and makes the build identity less visible for review.
- **Firebase Hosting plus a separate API:** possible, but not equivalent to this single-origin image because it adds CORS, hosting, and deployment coordination. Do not switch without a separate architecture review.

## 13. Source-of-truth documents

- [README.md](README.md) - product, architecture, quick start, and current cloud state.
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - requirements mapping and local implementation.
- [DOCKER_DEPLOYMENT_RUNBOOK.md](DOCKER_DEPLOYMENT_RUNBOOK.md) - Docker-specific build and release record.
- [CLOUD_IMPLEMENTATION_RUNBOOK.md](CLOUD_IMPLEMENTATION_RUNBOOK.md) - actual gcloud, Firebase, IAM, Secret Manager, Cloud Run, Scheduler, errors, and live evidence.
- [TEST_RESULTS.md](TEST_RESULTS.md) - manual test actions and observed results.
- [OWASP_LLM_TOP10_COVERAGE.md](OWASP_LLM_TOP10_COVERAGE.md) - LLM threat coverage and manual test cross-references.
- [CONSTITUTION.md](CONSTITUTION.md) - Google AI Studio Custom Instructions.

Official references: [Cloud Run deployment](https://docs.cloud.google.com/run/docs/deploying), [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity), [Cloud Build user-specified service accounts](https://docs.cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts), [Secret Manager](https://docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets), and [Cloud Run health checks](https://docs.cloud.google.com/run/docs/configuring/healthchecks).
