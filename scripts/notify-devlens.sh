#!/usr/bin/env bash
# Sends a signed pipeline event to the DevLens webhook.
#
# All values come from environment variables (never interpolated into the
# script), the JSON body is built with jq so quotes/newlines in commit messages
# are escaped, and the body is signed with HMAC-SHA256 using WEBHOOK_SECRET.
#
# Required: WEBHOOK_URL, WEBHOOK_SECRET, COMMIT_SHA, SERVICE_NAME, STATUS
# Optional: BRANCH, AUTHOR, ENVIRONMENT, PIPELINE_URL, COMMIT_MESSAGE, LANGUAGE, REPO_URL
set -euo pipefail

: "${WEBHOOK_URL:?WEBHOOK_URL is required}"
: "${WEBHOOK_SECRET:?WEBHOOK_SECRET is required}"

payload=$(jq -cn \
  --arg commit_sha     "${COMMIT_SHA:?}" \
  --arg service_name   "${SERVICE_NAME:?}" \
  --arg status         "${STATUS:?}" \
  --arg branch         "${BRANCH:-}" \
  --arg author         "${AUTHOR:-}" \
  --arg environment    "${ENVIRONMENT:-}" \
  --arg pipeline_url   "${PIPELINE_URL:-}" \
  --arg commit_message "${COMMIT_MESSAGE:-}" \
  --arg language       "${LANGUAGE:-}" \
  --arg repo_url       "${REPO_URL:-}" \
  '{commit_sha: $commit_sha, service_name: $service_name, status: $status, branch: $branch,
    author: $author, environment: $environment, pipeline_url: $pipeline_url,
    commit_message: ($commit_message | .[0:1000]), language: $language, repo_url: $repo_url}
   | with_entries(select(.value != ""))')

signature=$(printf '%s' "$payload" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $NF}')

curl -sS --fail-with-body --max-time 60 -X POST "${WEBHOOK_URL%/}/api/webhooks/pipeline" \
  -H "Content-Type: application/json" \
  -H "X-DevLens-Signature-256: sha256=${signature}" \
  -H "Bypass-Tunnel-Reminder: true" \
  -H "ngrok-skip-browser-warning: true" \
  --data-binary "$payload"
echo
