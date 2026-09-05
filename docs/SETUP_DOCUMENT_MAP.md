# Personal Gemini Journal Setup Document Map

## Purpose

This document is the navigation index for setting up, deploying, testing, publishing, and presenting Personal Gemini Journal for Google Cloud Gen AI Academy APAC Cohort 3.

The documents are intentionally separated by responsibility. Do not treat every Markdown file as a setup guide. Follow the workflow below in order and use each document for its stated purpose.

The current feature set includes a server-enforced **AI Journal / Private Journal** choice. It is intentionally visible throughout the public documentation because it is a user-facing privacy capability, not a private operator detail. The implementation source of truth is `server/src/lib/journalMode.ts`, the preference route is in `server/src/routes/journal.ts`, and the UI control is in `web/src/components/JournalModeToggle.tsx`.

| Order | Responsibility | Primary document | What to do |
| --- | --- | --- | --- |
| 1 | AI Studio security setup | [CONSTITUTION.md](CONSTITUTION.md) | Paste the complete contents into Google AI Studio Custom Instructions before asking AI Studio to build or extend the application. |
| 2 | AI Studio and requirements context | [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) | Follow the Google AI Studio, Firebase, local verification, and Academy requirements mapping. |
| 3 | Docker and image build | [DOCKER_DEPLOYMENT_RUNBOOK.md](DOCKER_DEPLOYMENT_RUNBOOK.md) | Follow the Dockerfile, Cloud Build, Artifact Registry, staged App Check, and image-release procedure. |
| 4 | Firebase and Cloud operations | [CLOUD_IMPLEMENTATION_RUNBOOK.md](CLOUD_IMPLEMENTATION_RUNBOOK.md) | Follow the generic project-specific setup for Firebase Auth, Firestore, App Check, Secret Manager, gcloud, IAM, Cloud Run, Scheduler, and production verification. |
| 5 | End-to-end operator flow | [CLOUD_IMPLEMENTATION_RUNBOOK.md](CLOUD_IMPLEMENTATION_RUNBOOK.md) | Use the public-safe cloud runbook together with the Docker runbook as the linear deployment path for a new project. |

## Setup Responsibilities

### 1. Google AI Studio

Use CONSTITUTION.md for the actual instruction artifact.

Use IMPLEMENTATION_GUIDE.md for:

- How the Academy codelab requirements map to this application.
- Where to paste the Custom Instructions.
- How Firebase terms, Authentication, Firestore, Secret Manager, Cloud Run, and labeling fit together.
- What local verification must happen before deployment.

The AI Studio setup is not the same thing as Cloud Run deployment. AI Studio provides the secure build instructions and development context; the repository is the source of truth for the resulting code, tests, deployment scripts, and rules.

### 2. Docker and Cloud Build

Use DOCKER_DEPLOYMENT_RUNBOOK.md for the executable container workflow.

The Docker path is:

~~~text
Dockerfile
  -> Cloud Build
  -> Artifact Registry
  -> Cloud Run
~~~

The root files involved are:

- Dockerfile: multi-stage web and server build, then lean runtime image.
- cloudbuild.yaml: Docker build arguments for public frontend configuration and Artifact Registry image output.
- scripts/provision-cloud-run.ps1: API enablement, user-managed build/runtime identities, named Secret Manager bindings, App Check settings, Cloud Run deployment, required label, and retention Scheduler.
- .dockerignore and .gcloudignore: build-context and upload exclusions.

Do not put Gemini credentials, deletion HMAC material, worker tokens, Firebase Admin credentials, or user data into Docker build arguments, image layers, source files, or public logs.

### 3. Firebase, Secret Manager, and Cloud Run

Use CLOUD_IMPLEMENTATION_RUNBOOK.md for the generic operator workflow.

It covers:

- Firebase Google Sign-In and Authorized Domains.
- Firestore creation, rules, indexes, and user-isolated paths.
- reCAPTCHA Enterprise website key and Firebase App Check registration.
- GEMINI_API_KEY, DELETION_HMAC_KEY, and RETENTION_WORKER_TOKEN.
- gcloud authentication and project selection.
- Dedicated Cloud Run build and runtime identities.
- Artifact Registry, Cloud Build, Cloud Run, and Scheduler.
- Required label dev-tutorial=cloud-run-ai-challenge.
- Manual production verification, retention evidence, rollback, and troubleshooting.

This document uses YOUR_* placeholders intentionally. Discover values from the target operator project instead of copying values from another deployment.

### 4. End-to-End Deployment

For a public repository, use CLOUD_IMPLEMENTATION_RUNBOOK.md together with DOCKER_DEPLOYMENT_RUNBOOK.md when one operator needs a single linear path. Separate self-deployment notes are local-only and are not required for the public deployment workflow.

It is the orchestration guide, not a replacement for the detailed Docker or Cloud runbooks. When it conflicts with the generic cloud runbook, the checked-in provisioning script and current source code are authoritative; update the documentation rather than silently choosing a different architecture.

## Documents That Are Not Setup Guides

These documents are important, but they should be used after setup or for a specific audience:

| Document | Use |
| --- | --- |
| TEST_RESULTS.md | Manual feature and deployment test actions, expected results, and evidence. |
| USABILITY_CHECKLIST.md | User-facing interaction and browser smoke verification. |
| OWASP_LLM_TOP10_COVERAGE.md | Security coverage, limitations, and manual security tests. |
| THREAT_MODEL.md / THREAT_MODEL.svg | Formal attack surface, visual boundaries, mitigations, residual risks, and deferred hardening decisions. |
| EVALUATION_DOSSIER.md | Reviewer-facing implementation and evaluation summary. |
| TECHNICAL_WRITEUP.md | Detailed technical rationale and data flow. |
| HOW_IT_WORKS.md | Plain-language product explanation. |
| Private GitHub publication guides | Local-only secret scan, upload, editing, and deletion procedures. These are intentionally not part of the public repository. |
| VIDEO_SUBMISSION_SCRIPT.md | Safe recording script and submission evidence sequence. |

Do not use README, evaluation, video, or test narrative text as a substitute for the executable deployment procedure.

## Fresh-Operator Checklist

- [ ] Read README.md.
- [ ] Read CONSTITUTION.md and configure Google AI Studio Custom Instructions.
- [ ] Read the AI Studio and requirements section of IMPLEMENTATION_GUIDE.md.
- [ ] Create or select a Firebase and Google Cloud project.
- [ ] Configure Google Sign-In, Firestore, Authorized Domains, and App Check.
- [ ] Create the three server-only Secret Manager secrets.
- [ ] Configure protected local Firebase build values and the App Check site key.
- [ ] Read DOCKER_DEPLOYMENT_RUNBOOK.md and confirm Docker or Cloud Build prerequisites.
- [ ] Read CLOUD_IMPLEMENTATION_RUNBOOK.md and set operator variables.
- [ ] Run scripts/provision-cloud-run.ps1 with a unique image tag.
- [ ] Verify the dedicated runtime identity, Secret Manager bindings, Scheduler, required label, and App Check enforcement.
- [ ] Run TEST_RESULTS.md and the production checks in CLOUD_IMPLEMENTATION_RUNBOOK.md.
- [ ] Review OWASP_LLM_TOP10_COVERAGE.md and record external gates separately.
- [ ] Review THREAT_MODEL.md and confirm residual risks are represented honestly.
- [ ] Review the public allowlist and confirm local secrets, generated output, emulator data, and deployment-only material are excluded before making the repository public.
- [ ] Record the demo using VIDEO_SUBMISSION_SCRIPT.md.
- [ ] Submit the required Cloud Run URL or walkthrough, social post with #AccelerateAIwithCloudRun, public repository, and brief description through the Academy process.

## Source-of-Truth Rules

- Source code and automated tests define behavior.
- `server/src/lib/journalMode.ts`, `/api/preferences`, and `JournalModeToggle.tsx` define the AI Journal / Private Journal processing boundary.
- firestore.rules and firestore.indexes.json define Firestore client access and required indexes.
- CONSTITUTION.md defines the AI Studio security instructions.
- scripts/provision-cloud-run.ps1 defines the supported provisioning path.
- DOCKER_DEPLOYMENT_RUNBOOK.md defines the container build and release path.
- CLOUD_IMPLEMENTATION_RUNBOOK.md defines the generic cloud operator path and safe execution record.
- TEST_RESULTS.md defines manual verification actions.
- THREAT_MODEL.md defines the formal attack surface and residual-risk register.
- README.md provides the public project overview and entry points.
- The Academy event page and official codelab define external submission requirements and deadlines.

When a feature or deployment setting changes:

1. Update the source implementation and tests.
2. Update the relevant runbook.
3. Update README.md and the evaluation documents.
4. Add or revise a manual verification step.
5. Re-run the public-safe scan before publishing.
