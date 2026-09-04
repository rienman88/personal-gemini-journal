[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$RecaptchaEnterpriseSiteKey,
  [switch]$DisableAppCheck,

  [string]$FirebaseApiKey,
  [string]$FirebaseAuthDomain,
  [string]$FirebaseProjectId,
  [string]$FirebaseStorageBucket,
  [string]$FirebaseMessagingSenderId,
  [string]$FirebaseAppId,

  [string]$Region = "asia-southeast1",
  [string]$ServiceName = "personal-gemini-journal",
  [string]$ServiceAccountName = "personal-gemini-journal-run",
  [string]$BuildServiceAccountName = "personal-gemini-journal-build",
  [string]$ArtifactRepository = "cloud-run-images",
  [string]$ImageTag = "",
  [string]$SchedulerJobName = "personal-gemini-journal-retention",
  [string]$RetentionSchedule = "0 2 * * *"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:RETENTION_WORKER_TOKEN)) {
  throw "Set RETENTION_WORKER_TOKEN in the current protected PowerShell session before running this script."
}

$appCheckEnabled = -not $DisableAppCheck

if ($appCheckEnabled) {
  if ([string]::IsNullOrWhiteSpace($RecaptchaEnterpriseSiteKey)) {
    $RecaptchaEnterpriseSiteKey = $env:VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
  }

  if ([string]::IsNullOrWhiteSpace($RecaptchaEnterpriseSiteKey)) {
    throw "A production reCAPTCHA Enterprise site key is required to enable Firebase App Check."
  }
} else {
  $RecaptchaEnterpriseSiteKey = ""
  Write-Warning "App Check is explicitly disabled for this deployment. Use this only for a staging pass while registering the production reCAPTCHA key."
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serviceAccountEmail = "$ServiceAccountName@$ProjectId.iam.gserviceaccount.com"
$buildServiceAccountEmail = "$BuildServiceAccountName@$ProjectId.iam.gserviceaccount.com"
$buildServiceAccountResource = "projects/$ProjectId/serviceAccounts/$buildServiceAccountEmail"
$retentionSecrets = @("GEMINI_API_KEY", "DELETION_HMAC_KEY", "RETENTION_WORKER_TOKEN")
$buildConfigPath = Join-Path $repositoryRoot "cloudbuild.yaml"

$firebaseBuildConfig = [ordered]@{
  VITE_FIREBASE_API_KEY = $FirebaseApiKey
  VITE_FIREBASE_AUTH_DOMAIN = $FirebaseAuthDomain
  VITE_FIREBASE_PROJECT_ID = $FirebaseProjectId
  VITE_FIREBASE_STORAGE_BUCKET = $FirebaseStorageBucket
  VITE_FIREBASE_MESSAGING_SENDER_ID = $FirebaseMessagingSenderId
  VITE_FIREBASE_APP_ID = $FirebaseAppId
}

$firebaseEnvironmentNames = @(
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
)

foreach ($name in $firebaseEnvironmentNames) {
  if ([string]::IsNullOrWhiteSpace($firebaseBuildConfig[$name])) {
    $firebaseBuildConfig[$name] = [Environment]::GetEnvironmentVariable($name)
  }

  if ([string]::IsNullOrWhiteSpace($firebaseBuildConfig[$name])) {
    throw "Missing $name. Pass the matching Firebase parameter or set $name in the deployment session."
  }

  if ($firebaseBuildConfig[$name].Contains(",")) {
    throw "$name cannot contain a comma because it is passed as a Cloud Build substitution."
  }
}

if ($appCheckEnabled -and $RecaptchaEnterpriseSiteKey.Contains(",")) {
  throw "RecaptchaEnterpriseSiteKey cannot contain a comma because it is passed as a Cloud Build substitution."
}

if ($firebaseBuildConfig.VITE_FIREBASE_PROJECT_ID -ne $ProjectId) {
  throw "VITE_FIREBASE_PROJECT_ID must match -ProjectId so Auth, Firestore, and Admin SDK use the same project."
}

if ([string]::IsNullOrWhiteSpace($ImageTag)) {
  $ImageTag = "release-" + [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
}

if ($ImageTag -notmatch "^[a-z0-9][a-z0-9._-]{0,127}$") {
  throw "ImageTag must contain only lowercase letters, digits, dots, underscores, or hyphens."
}

$imageUri = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepository/$ServiceName`:$ImageTag"

$gcloudCommand = Get-Command "gcloud.cmd" -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $gcloudCommand) {
  $gcloudCommand = Get-Command "gcloud" -ErrorAction SilentlyContinue | Select-Object -First 1
}

if ($null -eq $gcloudCommand) {
  throw "gcloud was not found on PATH. Install the Google Cloud CLI and reopen the terminal."
}

$gcloudExecutable = $gcloudCommand.Path
if ([string]::IsNullOrWhiteSpace($gcloudExecutable)) {
  $gcloudExecutable = $gcloudCommand.Source
}

function Invoke-Gcloud {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Windows PowerShell promotes native stderr to an error record even when
    # gcloud completed successfully. Preserve the exit code as the authority.
    $ErrorActionPreference = "Continue"
    & $gcloudExecutable @Arguments
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    $displayArguments = $Arguments -join " "
    if (-not [string]::IsNullOrWhiteSpace($env:RETENTION_WORKER_TOKEN)) {
      $displayArguments = $displayArguments.Replace($env:RETENTION_WORKER_TOKEN, "[REDACTED]")
    }
    throw "gcloud command failed: gcloud $displayArguments"
  }
}

function Get-GcloudValue {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $value = & $gcloudExecutable @Arguments
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "gcloud command failed: gcloud $($Arguments -join ' ')"
  }
  return ($value | Out-String).Trim()
}

function Test-GcloudResource {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & $gcloudExecutable @Arguments *> $null
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return $exitCode -eq 0
}

Write-Host "Configuring project $ProjectId in $Region..."
Invoke-Gcloud @("config", "set", "project", $ProjectId)
Invoke-Gcloud @(
  "services", "enable",
  "run.googleapis.com",
  "cloudbuild.googleapis.com",
  "artifactregistry.googleapis.com",
  "secretmanager.googleapis.com",
  "firestore.googleapis.com",
  "cloudscheduler.googleapis.com"
)

if (-not (Test-GcloudResource @("iam", "service-accounts", "describe", $serviceAccountEmail, "--project", $ProjectId))) {
  Write-Host "Creating user-managed runtime service account $serviceAccountEmail..."
  Invoke-Gcloud @(
    "iam", "service-accounts", "create", $ServiceAccountName,
    "--project", $ProjectId,
    "--display-name", "Personal Gemini Journal Cloud Run runtime"
  )
}

if (-not (Test-GcloudResource @("iam", "service-accounts", "describe", $buildServiceAccountEmail, "--project", $ProjectId))) {
  Write-Host "Creating user-managed Cloud Build service account $buildServiceAccountEmail..."
  Invoke-Gcloud @(
    "iam", "service-accounts", "create", $BuildServiceAccountName,
    "--project", $ProjectId,
    "--display-name", "Personal Gemini Journal Cloud Build image builder"
  )
}

# Keep image-build permissions separate from the Cloud Run runtime identity.
Invoke-Gcloud @(
  "projects", "add-iam-policy-binding", $ProjectId,
  "--member", "serviceAccount:$buildServiceAccountEmail",
  "--role", "roles/cloudbuild.builds.builder",
  "--condition=None"
)

if (-not (Test-GcloudResource @("artifacts", "repositories", "describe", $ArtifactRepository, "--location", $Region, "--project", $ProjectId))) {
  Write-Host "Creating Artifact Registry repository $ArtifactRepository in $Region..."
  Invoke-Gcloud @(
    "artifacts", "repositories", "create", $ArtifactRepository,
    "--repository-format=docker",
    "--location", $Region,
    "--project", $ProjectId,
    "--description", "Personal Gemini Journal Cloud Run images"
  )
}

Invoke-Gcloud @(
  "artifacts", "repositories", "add-iam-policy-binding", $ArtifactRepository,
  "--location", $Region,
  "--project", $ProjectId,
  "--member", "serviceAccount:$buildServiceAccountEmail",
  "--role", "roles/artifactregistry.writer"
)

# The server needs Firestore data access and read access to only the secrets
# listed below. It does not need owner/editor or Firebase client permissions.
Invoke-Gcloud @(
  "projects", "add-iam-policy-binding", $ProjectId,
  "--member", "serviceAccount:$serviceAccountEmail",
  "--role", "roles/datastore.user",
  "--condition=None"
)

foreach ($secret in $retentionSecrets) {
  if (-not (Test-GcloudResource @("secrets", "describe", $secret, "--project", $ProjectId))) {
    throw "Secret Manager secret '$secret' does not exist in project '$ProjectId'. Create it before deployment."
  }

  Invoke-Gcloud @(
    "secrets", "add-iam-policy-binding", $secret,
    "--project", $ProjectId,
    "--member", "serviceAccount:$serviceAccountEmail",
    "--role", "roles/secretmanager.secretAccessor",
    "--condition=None"
  )
}

$secretBindings = "GEMINI_API_KEY=GEMINI_API_KEY:latest,DELETION_HMAC_KEY=DELETION_HMAC_KEY:latest,RETENTION_WORKER_TOKEN=RETENTION_WORKER_TOKEN:latest"
$buildSubstitutions = @(
  "_IMAGE_URI=$imageUri",
  "_VITE_FIREBASE_API_KEY=$($firebaseBuildConfig.VITE_FIREBASE_API_KEY)",
  "_VITE_FIREBASE_AUTH_DOMAIN=$($firebaseBuildConfig.VITE_FIREBASE_AUTH_DOMAIN)",
  "_VITE_FIREBASE_PROJECT_ID=$($firebaseBuildConfig.VITE_FIREBASE_PROJECT_ID)",
  "_VITE_FIREBASE_STORAGE_BUCKET=$($firebaseBuildConfig.VITE_FIREBASE_STORAGE_BUCKET)",
  "_VITE_FIREBASE_MESSAGING_SENDER_ID=$($firebaseBuildConfig.VITE_FIREBASE_MESSAGING_SENDER_ID)",
  "_VITE_FIREBASE_APP_ID=$($firebaseBuildConfig.VITE_FIREBASE_APP_ID)",
  "_VITE_USE_EMULATORS=false",
  "_VITE_ENABLE_APP_CHECK=$($appCheckEnabled.ToString().ToLowerInvariant())",
  "_VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=$RecaptchaEnterpriseSiteKey",
  "_VITE_API_BASE_URL="
) -join ","

if (-not (Test-Path -LiteralPath $buildConfigPath)) {
  throw "Missing Cloud Build configuration: $buildConfigPath"
}

Write-Host "Building Docker image $imageUri with Cloud Build..."
Invoke-Gcloud @(
  "builds", "submit", $repositoryRoot,
  "--project", $ProjectId,
  "--region", $Region,
  "--config", $buildConfigPath,
  "--service-account", "projects/$ProjectId/serviceAccounts/$buildServiceAccountEmail",
  "--substitutions", $buildSubstitutions,
  "--quiet"
)

Write-Host "Deploying Docker image with the least-privilege runtime identity..."
Invoke-Gcloud @(
  "run", "deploy", $ServiceName,
  "--image", $imageUri,
  "--project", $ProjectId,
  "--region", $Region,
  "--allow-unauthenticated",
  "--service-account", $serviceAccountEmail,
  "--update-env-vars", "ENFORCE_APP_CHECK=$($appCheckEnabled.ToString().ToLowerInvariant()),GCP_PROJECT=$ProjectId",
  "--set-secrets", $secretBindings,
  "--quiet"
)

Invoke-Gcloud @(
  "run", "services", "update", $ServiceName,
  "--project", $ProjectId,
  "--region", $Region,
  "--update-labels", "dev-tutorial=cloud-run-ai-challenge"
)

$serviceUrl = Get-GcloudValue @(
  "run", "services", "describe", $ServiceName,
  "--project", $ProjectId,
  "--region", $Region,
  "--format=value(status.url)"
)

$schedulerArgs = @(
  "--project", $ProjectId,
  "--location", $Region,
  "--schedule", $RetentionSchedule,
  "--uri", "$serviceUrl/internal/retention/redact",
  "--http-method", "POST",
  "--headers", "Content-Type=application/json,X-Retention-Worker-Token=$env:RETENTION_WORKER_TOKEN",
  "--message-body", '{\"limit\":50}',
  "--quiet"
)

if (Test-GcloudResource @("scheduler", "jobs", "describe", $SchedulerJobName, "--project", $ProjectId, "--location", $Region)) {
  Write-Host "Updating daily retention scheduler $SchedulerJobName..."
  $schedulerUpdateArgs = @(
    "--project", $ProjectId,
    "--location", $Region,
    "--schedule", $RetentionSchedule,
    "--uri", "$serviceUrl/internal/retention/redact",
    "--http-method", "POST",
    "--update-headers", "Content-Type=application/json,X-Retention-Worker-Token=$env:RETENTION_WORKER_TOKEN",
    "--message-body", '{\"limit\":50}',
    "--quiet"
  )
  Invoke-Gcloud (@("scheduler", "jobs", "update", "http", $SchedulerJobName) + $schedulerUpdateArgs) | Out-Null
} else {
  Write-Host "Creating daily retention scheduler $SchedulerJobName..."
  Invoke-Gcloud (@("scheduler", "jobs", "create", "http", $SchedulerJobName) + $schedulerArgs) | Out-Null
}

Write-Host "Provisioning complete. Cloud Run URL: $serviceUrl"
Write-Host "Docker image: $imageUri"
Write-Host "Runtime service account: $serviceAccountEmail"
Write-Host "Build service account: $buildServiceAccountEmail"
Write-Host "App Check enforced: $appCheckEnabled"
Write-Host "Retention schedule: $RetentionSchedule ($Region)"
