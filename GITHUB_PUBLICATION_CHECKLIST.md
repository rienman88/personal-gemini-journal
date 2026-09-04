# GitHub Publication Checklist

The public repository includes the source-controlled [architecture diagram](docs/ARCHITECTURE.svg). Review it with the source and deployment runbooks before publication; it contains no credentials or user data.

**Programme:** Google Cloud Gen AI Academy APAC Edition, Cohort 3  
**Repository:** Personal Gemini Journal  
**Audit date:** 2026-09-03  
**Current state:** Publication-ready boundary prepared; no Git repository has been initialized, and no files have been staged, committed, or pushed by this task.

This checklist is specific to the current implementation. It prepares the source repository for manual review and public GitHub or GitLab publication without exposing local credentials, generated artifacts, emulator data, or deployment-only material. Publishing the repository does not by itself deploy Cloud Run; the current deployment path remains Docker -> Cloud Build -> Artifact Registry -> Cloud Run as documented in [SELF_DEPLOYMENT_GUIDE.md](SELF_DEPLOYMENT_GUIDE.md).

## 1. Publication status

- [x] Repository boundary audited without initializing Git.
- [x] `.gitignore` strengthened for dependencies, generated output, local configuration, logs, emulator state, certificates, and credential filenames.
- [x] Safe environment templates remain publishable: `server/.env.example` and `web/.env.example`.
- [x] Root, server, and web lockfiles are present for reproducible dependency installation.
- [x] Firebase rules and indexes are included as source-controlled deployment artifacts.
- [x] Docker, Cloud Build, provisioning, and implementation runbooks are included.
- [ ] Operator removes or rotates the local service-account key if it was ever shared, committed, uploaded, or backed up outside the local machine.
- [ ] Operator initializes Git and reviews the dry-run file list.
- [ ] Operator creates the first commit after the review passes.
- [ ] Operator adds the intended GitHub/GitLab remote and pushes the reviewed commit.
- [ ] Operator enables repository secret scanning and branch protection where available.
- [ ] Operator chooses an explicit repository license if public reuse is intended; do not add one without selecting the desired legal terms.

## 2. Local-only material excluded from GitHub

The following files or directories exist locally or may be generated during development. They must not be published:

| Local material | Reason | Rule or handling |
| --- | --- | --- |
| `server/.env` | Contains server runtime secrets, including the Gemini API key | Ignored by `**/.env*`; never force-add |
| `web/.env.local` | Contains local browser configuration and local development flags | Ignored by `**/.env*`; never force-add |
| `server/key.json` | Service-account private key material | Ignored by `key.json` and `**/key.json`; revoke and replace if exposed |
| `node_modules/` | Installed dependencies | Ignored recursively; restore with lockfiles |
| `server/lib/` | Compiled server output | Ignored; rebuild with the package scripts |
| `web/dist/` and `web-dist/` | Generated frontend/runtime output | Ignored; rebuild from source |
| `web/test-results/` and `web/playwright-report/` | Local browser test artifacts | Ignored; retain only selected evidence outside the source tree |
| `.firebase/` | Firebase Emulator state | Ignored; do not publish local database state |
| `*.log` | Local emulator and runtime logs | Ignored; inspect locally, do not commit |
| `.npmrc` | May contain private registry tokens or machine-specific npm settings | Ignored recursively; do not publish credentials |
| Private certificates and keystores | Credential material | Ignored by extension and credential-name rules |

Important: an ignored file is safe only if it is not force-added. Do not use `git add -f` for any item in this table.

## 3. Files that should be included

These are the important source and review artifacts for the current application:

- `README.md`, `HOW_IT_WORKS.md`, `IMPLEMENTATION_GUIDE.md`, and `CONSTITUTION.md`
- `EVALUATION_DOSSIER.md`, `TECHNICAL_WRITEUP.md`, `OWASP_LLM_TOP10_COVERAGE.md`, `USABILITY_CHECKLIST.md`, and `TEST_RESULTS.md`
- `SELF_DEPLOYMENT_GUIDE.md`, `DOCKER_DEPLOYMENT_RUNBOOK.md`, `CLOUD_IMPLEMENTATION_RUNBOOK.md`, and this checklist
- `docs/ARCHITECTURE.svg` for the current source-controlled architecture image
- `.gitignore`, `Dockerfile`, `.dockerignore`, `.gcloudignore`, `cloudbuild.yaml`, `firebase.json`, and `.firebaserc`
- `firestore.rules` and `firestore.indexes.json`
- `package.json` and `package-lock.json`
- `server/package.json`, `server/package-lock.json`, `server/src/`, and `server/test/`
- `web/package.json`, `web/package-lock.json`, `web/src/`, `web/smoke/`, `web/index.html`, and the Vite configuration files
- `scripts/provision-cloud-run.ps1`
- `server/.env.example` and `web/.env.example`, after confirming they contain placeholders only

The source includes the currently implemented capabilities: Firebase Google Sign-In, owner-isolated Firestore storage, server-side Gemini access, Privacy Guardian interception, multi-turn conversations, SHA-256 integrity chains, audit activity, category relationships, Calendar v1, entry deletion, privacy-safe 30-day redaction, App Check support, dedicated Cloud Run identities, Secret Manager bindings, and the retention Scheduler path. The documentation is the authoritative description of which production gates are complete versus still operator-controlled.

## 4. Pre-publication review without staging

Run these checks from the repository root before initializing or staging Git:

```powershell
Get-ChildItem -Force
rg --files --ignore-file .gitignore -g '!node_modules/**' -g '!web/node_modules/**' -g '!server/node_modules/**' -g '!web-dist/**' -g '!server/lib/**' -g '!*.log' | Sort-Object
```

Confirm that the output contains source, tests, rules, lockfiles, deployment scripts, and documentation, but does not contain `server/.env`, `web/.env.local`, `server/key.json`, dependencies, generated output, or logs.

Run a path-only credential scan. This reports only the file and match type, not the matching line or secret value:

```powershell
$patterns = [ordered]@{
  'private-key' = '-----BEGIN [^-]*PRIVATE KEY-----'
  'service-account' = '"type"\s*:\s*"service_account"'
  'google-api-key' = 'AIza[0-9A-Za-z_-]{20,}'
  'aws-access-key' = 'AKIA[0-9A-Z]{16}'
}

Get-ChildItem -Recurse -File -Force |
  Where-Object {
    $_.FullName -notmatch '\\node_modules\\|\\web-dist\\|\\server\\lib\\|\\.firebase\\|\\\.git\\' -and
    $_.Extension -notin @('.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.map')
  } |
  ForEach-Object {
    $path = $_.FullName
    $text = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
    foreach ($name in $patterns.Keys) {
      if ($text -match $patterns[$name]) {
        '{0}: {1}' -f $path, $name
      }
    }
  }
```

Review every result. The current test documentation contains the intentionally fake fixture `AKIAABCDEFGHIJKLMNOP`; that is not a production credential, but it should remain clearly labeled as test data. Any real key or private key result blocks publication until it is removed from the publishable tree and rotated if exposure is possible.

## 5. Git dry run and first publication

Do not run this section until the manual review is complete. These commands are intentionally operator-run because the repository owner must choose the remote URL and approve the initial commit.

```powershell
git init
git branch -M main
git add -n .
git status --short --ignored
git check-ignore -v server/.env web/.env.local server/key.json firestore-debug.log web-dist node_modules
```

Expected result:

- `git add -n .` lists application source, tests, rules, deployment files, docs, examples, and lockfiles.
- The local-only paths are excluded from the dry-run add list.
- `git check-ignore -v` identifies the matching `.gitignore` rule for every local-only path.
- No command output contains credential values.

After the list passes manual review:

```powershell
git add .
git diff --cached --name-status
git diff --cached --check
git commit -m "Prepare Personal Gemini Journal for Academy review"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

If the repository already exists remotely, inspect its branch and protection policy before pushing. Do not overwrite an existing remote history without an explicit decision.

## 6. Post-publication GitHub controls

- [ ] Confirm the public file browser does not show `.env`, `key.json`, logs, emulator state, dependency folders, or generated output.
- [ ] Enable secret scanning and push protection if available for the repository visibility and plan.
- [ ] Protect `main` and require review before changes to `firestore.rules`, `firestore.indexes.json`, `Dockerfile`, `cloudbuild.yaml`, or `scripts/provision-cloud-run.ps1`.
- [ ] Do not store `GEMINI_API_KEY`, `DELETION_HMAC_KEY`, `RETENTION_WORKER_TOKEN`, or service-account private keys in GitHub repository files.
- [ ] If GitHub Actions is added later, use workload identity federation or another short-lived credential mechanism instead of downloaded service-account keys.
- [ ] Keep Cloud Run deployment credentials and Secret Manager values in Google Cloud, not in GitHub source.

## 7. Deployment relationship

GitHub is the source and review boundary. The current deployment implementation is separate:

1. `scripts/provision-cloud-run.ps1` provisions Google Cloud APIs, dedicated build/runtime identities, Artifact Registry, Secret Manager bindings, Cloud Run, the cohort label, and the retention Scheduler.
2. `cloudbuild.yaml` builds the Docker image and pushes it to Artifact Registry.
3. Cloud Run receives the immutable image and runtime secret references; secrets are not baked into the image.
4. Firebase Console actions remain required for Auth provider setup, Authorized Domains, App Check registration, and final production checks.

See [CLOUD_IMPLEMENTATION_RUNBOOK.md](CLOUD_IMPLEMENTATION_RUNBOOK.md) for the actual staging execution record and [TEST_RESULTS.md](TEST_RESULTS.md) for the manual and automated verification matrix.

## 8. Known operator actions before claiming final readiness

- Register the production reCAPTCHA Enterprise site key and deploy with App Check enforcement enabled.
- Execute a controlled due-record retention test and record the final `Deleted` transformation evidence.
- Review production IAM inheritance for the dedicated build and runtime accounts.
- Add the exact production Cloud Run host to Firebase Authentication Authorized Domains.
- Publish the reviewed repository, record its URL, and submit the Cloud Run URL, source URL, demo evidence, and required project/service details through the Academy Cohort 3 dashboard.

Do not claim these items as complete merely because the code path exists. They require external operator evidence.
