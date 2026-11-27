#!/usr/bin/env bash
# Nightly encrypted logical dump to the second provider (P3.S5a Task 7; run by cron on the data-tier node, P3.S5b).
# A second, independent copy beside pgBackRest: pg_dump (custom format) of the data tier's postgres, encrypted to a
# public key already in the node's keyring, then one signed PUT to the second provider's S3 bucket. Retention is that
# bucket's own lifecycle rule. Not run in P3.S5a (no account yet).
#
#   DUMP_GPG_RECIPIENT=<key id or email> DUMP_S3_ENDPOINT=https://… DUMP_S3_BUCKET=… DUMP_S3_REGION=… \
#   DUMP_S3_ACCESS_KEY=… DUMP_S3_SECRET_KEY=… scripts/ops/nightly-dump.sh
#   COMPOSE_PROJECT_NAME / COMPOSE_FILE select the data tier (default: the compose file in the repo checkout).
#
# The script never makes or imports a key: the operator imports the recipient's public key once (runbook); the
# private key never sits on this node. Credentials reach curl on stdin (-K -). Never add `set -x`.
set -euo pipefail
cd "$(dirname "$0")/../.."

for key in DUMP_GPG_RECIPIENT DUMP_S3_ENDPOINT DUMP_S3_BUCKET DUMP_S3_REGION DUMP_S3_ACCESS_KEY DUMP_S3_SECRET_KEY \
  POSTGRES_USER POSTGRES_DB; do
  [[ -n "${!key:-}" ]] || { echo "nightly-dump: $key is not set" >&2; exit 1; }
done
# Private data never goes to R2 (ADR 0012), whatever the variable says.
if [[ "$DUMP_S3_ENDPOINT" =~ r2\.cloudflarestorage|r2\.dev ]]; then
  echo "nightly-dump: refusing an R2 endpoint (ADR 0012)" >&2
  exit 1
fi
gpg --batch --list-keys "$DUMP_GPG_RECIPIENT" >/dev/null 2>&1 ||
  { echo "nightly-dump: no public key for DUMP_GPG_RECIPIENT in the keyring" >&2; exit 1; }

spool=$(mktemp -d)
trap 'rm -rf "$spool"' EXIT
name="cod-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg"

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner |
  gpg --batch --yes --trust-model always --encrypt --recipient "$DUMP_GPG_RECIPIENT" --output "$spool/$name"

printf 'user = "%s:%s"\n' "$DUMP_S3_ACCESS_KEY" "$DUMP_S3_SECRET_KEY" |
  curl -sS --fail-with-body --max-time 1800 --aws-sigv4 "aws:amz:$DUMP_S3_REGION:s3" -K - \
    -T "$spool/$name" "${DUMP_S3_ENDPOINT%/}/$DUMP_S3_BUCKET/logical/$name" >/dev/null
echo "NIGHTLY-DUMP-OK $name ($(stat -c %s "$spool/$name") bytes)"
