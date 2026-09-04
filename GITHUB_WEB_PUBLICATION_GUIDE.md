# GitHub Web Publication Guide

## Scope

This guide is the repository-specific web workflow for publishing Personal Gemini Journal as a public GitHub repository. It is intentionally separate from the command-line Git workflow because this workspace does not currently contain a `.git` directory and the owner wants to upload, edit, and remove files through the GitHub web interface.

GitHub is the public source and review boundary. Publishing to GitHub does not deploy Cloud Run. The actual deployment remains Docker -> Cloud Build -> Artifact Registry -> Cloud Run, as recorded in [CLOUD_IMPLEMENTATION_RUNBOOK.md](CLOUD_IMPLEMENTATION_RUNBOOK.md).

## Git Concepts Refresher

- Repository: the online project containing source, history, issues, and settings.
- File: one source or documentation item stored in the repository.
- Commit: a recorded snapshot of changes with a message.
- Branch: an independent line of repository history. `main` is normally the default branch.
- Pull request: a reviewable proposal to merge one branch into another.
- Public repository: anyone can view, download, fork, and preserve copies of the repository and its history.

For this first publication, a direct commit to `main` is acceptable after the manual allowlist review. For later source changes, use a new branch and pull request when practical.

## Current Local Boundary

The workspace is not currently a Git repository. No local commit, remote, or push has been created by this task.

The locally present items below must not be uploaded:

- `server/.env`
- `web/.env.local`
- `server/key.json`
- `server/lib/`
- `web/dist/`
- `web-dist/`
- `node_modules/`, `web/node_modules/`, and `server/node_modules/`
- `web/test-results/` and `web/playwright-report/`
- `.firebase/`
- `*.log`, including `firestore-debug.log`
- private keys, certificates, keystores, service-account JSON files, and machine-specific `.npmrc` files

The `.gitignore`, `.dockerignore`, and `.gcloudignore` files are publishable and should be uploaded. However, GitHub's browser upload does not decide which local files to exclude for you. Select only the approved source files and folders.

The local path-only credential scan found only the deliberately fake fixture `AKIAABCDEFGHIJKLMNOP` in test/documentation material. Review those matches as test data. If any real credential appears, stop publication, rotate or revoke it, remove it from the publishable files, and do not rely on deleting the file later.

## Approved Upload Set

Upload these repository items from the workspace:

- Root documentation: `README.md`, `HOW_IT_WORKS.md`, `IMPLEMENTATION_GUIDE.md`, `CONSTITUTION.md`, `EVALUATION_DOSSIER.md`, `TECHNICAL_WRITEUP.md`, `OWASP_LLM_TOP10_COVERAGE.md`, `USABILITY_CHECKLIST.md`, `TEST_RESULTS.md`, `SELF_DEPLOYMENT_GUIDE.md`, `DOCKER_DEPLOYMENT_RUNBOOK.md`, `CLOUD_IMPLEMENTATION_RUNBOOK.md`, `GITHUB_PUBLICATION_CHECKLIST.md`, and `VIDEO_SUBMISSION_SCRIPT.md`
- Root configuration: `.gitignore`, `.dockerignore`, `.gcloudignore`, `.firebaserc`, `Dockerfile`, `cloudbuild.yaml`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `package.json`, and `package-lock.json`
- `docs/ARCHITECTURE.svg`
- `scripts/provision-cloud-run.ps1`
- `server/.env.example`, `server/package.json`, `server/package-lock.json`, `server/tsconfig.json`, `server/src/`, and `server/test/`
- `web/.env.example`, `web/package.json`, `web/package-lock.json`, `web/tsconfig.json`, `web/index.html`, `web/playwright.config.ts`, `web/vite.config.ts`, `web/vite.smoke.config.ts`, `web/src/`, and `web/smoke/`

The current approved set contains approximately 88 files and is below GitHub browser-upload limits. GitHub currently documents a 25 MiB per-file browser limit and a maximum of 100 files per upload. See [Adding a file to a repository](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

## Step 1: Final Local Review

From PowerShell at the repository root, confirm the local-only material exists only locally and inspect the approved file list:

~~~powershell
$paths = @(
  "server/.env",
  "web/.env.local",
  "server/key.json",
  "firestore-debug.log",
  "web-dist",
  "server/lib",
  "web/test-results",
  "node_modules"
)

foreach ($path in $paths) {
  "{0}: {1}" -f $path, (Test-Path -LiteralPath $path)
}

rg --files --hidden --ignore-file .gitignore `
  -g '!node_modules/**' `
  -g '!web/node_modules/**' `
  -g '!server/node_modules/**' `
  -g '!web-dist/**' `
  -g '!server/lib/**' `
  -g '!web/test-results/**' `
  -g '!web/playwright-report/**' `
  -g '!*.log' |
  Sort-Object
~~~

Confirm the list contains source, tests, rules, lockfiles, deployment files, documentation, and examples. It must not contain the local-only paths above.

The current application build and smoke checks are already recorded as passing. If you edit anything locally before upload, rerun:

~~~powershell
npm run build
npm run test:smoke --prefix web
~~~

## Step 2: Create the Public Repository

1. Sign in to [GitHub](https://github.com/).
2. Select the `+` menu in the upper-right corner and choose **New repository**.
3. Set the repository name to `personal-gemini-journal` or another name you choose.
4. Add a short description such as `Privacy-aware AI journaling with Firebase, Gemini, Firestore, App Check, and Cloud Run.`
5. Select **Public**.
6. Do not select **Add a README file** because the repository already has the implementation README.
7. Do not create a second `.gitignore` from the GitHub template because the repository already has a project-specific one.
8. Do not add a license until you have selected the legal terms you want. A public repository without a license remains publicly viewable but does not automatically grant reuse rights.
9. Select **Create repository**.

Do not paste any secret, Firebase Admin credential, Gemini key, worker token, or App Check token into the description, topics, README, issue text, or repository settings.

## Step 3: Upload the Source Through the Web UI

Upload in batches so the file selection is easy to audit:

1. Open the empty repository's **Code** tab.
2. Select **Add file** -> **Upload files**.
3. Upload the approved root files first, including hidden files such as `.gitignore`, `.dockerignore`, `.gcloudignore`, and `.firebaserc`. Enable **Hidden items** in Windows File Explorer if needed.
4. Drag the approved `docs/` folder into the upload area and confirm the path remains `docs/ARCHITECTURE.svg`.
5. Upload `scripts/`.
6. Upload `server/`, confirming that `server/.env.example` is included but `server/.env` and `server/key.json` are not.
7. Upload `web/`, confirming that `web/.env.example` is included but `web/.env.local`, dependencies, and browser test output are not.
8. In the commit message, enter:

   `Publish Personal Gemini Journal for Google Cloud Gen AI Academy Cohort 3 review`

9. Select **Commit directly to the `main` branch** for the first upload.
10. Select **Commit changes**.

If GitHub reports a secret during upload, do not bypass the protection. Remove the item, determine whether the match is the documented fake fixture or a real secret, and rotate any real credential before continuing. GitHub push protection is specifically intended to block accidental secret publication. See [GitHub secret protection guidance](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository).

## Step 4: Verify the Public Repository

After the upload finishes:

- Open the rendered `README.md` and confirm the architecture image loads.
- Open `docs/ARCHITECTURE.svg` and confirm it contains no secrets or user data.
- Confirm `server/.env.example` and `web/.env.example` contain placeholders only.
- Confirm `server/.env`, `web/.env.local`, `server/key.json`, `node_modules/`, `web-dist/`, `server/lib/`, and logs are absent.
- Confirm `firestore.rules`, `firestore.indexes.json`, `Dockerfile`, `cloudbuild.yaml`, and `scripts/provision-cloud-run.ps1` are present.
- Confirm the feature and evidence documents are present, including `VIDEO_SUBMISSION_SCRIPT.md`.
- Use GitHub repository search for `GEMINI_API_KEY`, `DELETION_HMAC_KEY`, `RETENTION_WORKER_TOKEN`, `BEGIN PRIVATE KEY`, `AIza`, and `AKIA`.
- Treat the known `AKIAABCDEFGHIJKLMNOP` test fixture as expected fake data only. Any other key-looking result requires review before submission.
- Open the repository's **Security** or **Security and quality** area and review secret-scanning results.

For public repositories, GitHub provides secret scanning availability automatically in many plans. Enable **Secret Protection**, secret scanning, and push protection when the repository settings expose those controls. Review the current GitHub UI because availability and labels can vary by account and plan. See [Enabling secret scanning](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning).

## Step 5: Edit a File on GitHub

For Markdown or small text corrections:

1. Browse to the file.
2. Select the pencil **Edit this file** control.
3. Make the change.
4. Select **Preview changes**.
5. Review the rendered Markdown and the diff.
6. Select **Commit changes**.
7. Use a specific message such as `Clarify App Check verification wording`.
8. For a simple documentation correction, commit to `main`. For code, rules, Docker, deployment, or security changes, prefer a new branch and pull request.

GitHub documents this workflow in [Editing files](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files).

Important: GitHub web editing does not run the application build or smoke tests. After a web edit, download or clone the updated repository into a clean local directory, run the build and tests, and only then redeploy. Do not deploy an older local copy by mistake.

## Step 6: Remove a File on GitHub

To delete one file:

1. Browse to the file.
2. Select the top-right `...` menu.
3. Select **Delete file**.
4. Review the diff and enter a meaningful commit message.
5. Commit directly or create a branch and pull request.

To remove a directory, delete its files individually. GitHub displays the directory only while it contains files.

Deleting a file from the current branch does not remove it from Git history. If the file contained a real secret, immediately rotate or revoke the secret and follow GitHub's sensitive-data removal process. Do not treat ordinary file deletion as secret remediation. See [Deleting files](https://docs.github.com/en/repositories/working-with-files/managing-files/deleting-files-in-a-repository).

## Step 7: Safe Web Editing Rules

- Documentation-only edits can be made directly on `main` after reviewing the diff.
- Never edit `.env.example` to include real values.
- Never create `server/.env`, `web/.env.local`, `key.json`, service-account JSON, or credential files in GitHub.
- Do not paste Cloud Run URLs containing temporary tokens or copied Scheduler headers into issues or commits.
- Treat Firebase web configuration and reCAPTCHA site keys as public build configuration, but do not confuse them with server secrets.
- Changes to `firestore.rules`, `Dockerfile`, `cloudbuild.yaml`, `scripts/provision-cloud-run.ps1`, authentication, App Check, or retention logic require a local build/test review before deployment.
- Keep the video script, README, evaluation dossier, and test results aligned when implementation behavior changes.

## Step 8: GitHub to Cloud Run Relationship

GitHub web commits do not automatically deploy this application. The safe release sequence after a web edit is:

1. Download or clone the exact current GitHub revision.
2. Review the changed files and commit history.
3. Confirm no local secrets or generated output entered the clean checkout.
4. Run `npm run build`.
5. Run `npm run test:smoke --prefix web` and the documented server emulator suite when the change affects the server.
6. Run the repository provisioning script from the reviewed checkout.
7. Use a new immutable image tag.
8. Verify Cloud Run revision, App Check enforcement, Secret Manager bindings, Scheduler, health endpoints, and the required cohort label.
9. Record the release evidence in `CLOUD_IMPLEMENTATION_RUNBOOK.md` and `TEST_RESULTS.md`.

The deployment remains dependent on Google Cloud configuration outside GitHub: Firebase Authorized Domains, Firebase App Check registration, Secret Manager values, IAM, Cloud Run, Firestore, Cloud Build, Artifact Registry, and Scheduler.

## Publication Checklist

- [ ] Local-only files excluded from the browser upload.
- [ ] Root dotfiles uploaded intentionally.
- [ ] Source, tests, rules, lockfiles, architecture image, scripts, and documents uploaded.
- [ ] README renders correctly and links resolve.
- [ ] No real secret appears in files, commit messages, issues, or repository settings.
- [ ] Known fake AWS fixture is clearly test-only.
- [ ] Public repository visibility confirmed.
- [ ] Secret scanning and push protection reviewed or enabled where available.
- [ ] License decision made explicitly.
- [ ] Repository URL recorded for the Academy submission.
- [ ] Video URL and safe evaluator access instructions prepared separately.
- [ ] Any post-upload web edit has been rebuilt and retested locally before redeployment.
