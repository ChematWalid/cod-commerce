#!/usr/bin/env bash
# Sets the private bucket's lifecycle rules on Garage (ADR 0011: only Expiration and AbortIncompleteMultipartUpload,
# the prefix inside Filter; #270 item 1, D3520), then reads them back and fails unless all three are stored:
#   - uploads/  (import sources): expire after UPLOADS_EXPIRE_DAYS;
#   - exports/  (export files and import error reports): expire after EXPORTS_EXPIRE_DAYS;
#   - every key: abort multipart uploads left incomplete for a day.
# Only lifecycle rules: it never creates, lists or prints a key. The per-bucket, per-role keys are a P3.S5b manual
# step (garage key create on the node). Never run it against R2: R2 holds public assets only (ADR 0012).
#
#   S3_ENDPOINT=http://127.0.0.1:3900 S3_ACCESS_KEY=… S3_SECRET_KEY=… S3_BUCKET_PRIVATE=… scripts/ops/garage-lifecycle.sh
#
# The key pair reaches curl through its config on stdin (-K -), never through its command line. Never add `set -x`.
set -euo pipefail

readonly UPLOADS_EXPIRE_DAYS=7 EXPORTS_EXPIRE_DAYS=30 ABORT_MULTIPART_DAYS=1
readonly RULE_IDS=(expire-uploads expire-exports abort-incomplete-multipart)

for key in S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET_PRIVATE; do
  [[ -n "${!key:-}" ]] || { echo "garage-lifecycle: $key is not set" >&2; exit 1; }
done
case "$S3_ENDPOINT" in
  *r2.cloudflarestorage.com* | *r2.dev*) echo "garage-lifecycle: refusing an R2 endpoint (ADR 0012)" >&2; exit 1 ;;
esac

url="${S3_ENDPOINT%/}/$S3_BUCKET_PRIVATE?lifecycle"
sigv4="aws:amz:${S3_REGION:-garage}:s3"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

command cat >"$work/lifecycle.xml" <<XML
<?xml version="1.0" encoding="UTF-8"?>
<LifecycleConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Rule>
    <ID>expire-uploads</ID>
    <Status>Enabled</Status>
    <Filter><Prefix>uploads/</Prefix></Filter>
    <Expiration><Days>$UPLOADS_EXPIRE_DAYS</Days></Expiration>
  </Rule>
  <Rule>
    <ID>expire-exports</ID>
    <Status>Enabled</Status>
    <Filter><Prefix>exports/</Prefix></Filter>
    <Expiration><Days>$EXPORTS_EXPIRE_DAYS</Days></Expiration>
  </Rule>
  <Rule>
    <ID>abort-incomplete-multipart</ID>
    <Status>Enabled</Status>
    <Filter><Prefix></Prefix></Filter>
    <AbortIncompleteMultipartUpload><DaysAfterInitiation>$ABORT_MULTIPART_DAYS</DaysAfterInitiation></AbortIncompleteMultipartUpload>
  </Rule>
</LifecycleConfiguration>
XML

# s3 <curl args...>: one signed request; the credentials go in on stdin.
s3() {
  printf 'user = "%s:%s"\n' "$S3_ACCESS_KEY" "$S3_SECRET_KEY" |
    curl -sS --fail-with-body --max-time 20 --aws-sigv4 "$sigv4" -K - "$@"
}

md5=$(openssl dgst -md5 -binary "$work/lifecycle.xml" | base64)
s3 -X PUT -H "Content-MD5: $md5" -H 'Content-Type: application/xml' --data-binary "@$work/lifecycle.xml" "$url" >/dev/null
s3 "$url" >"$work/stored.xml"
for id in "${RULE_IDS[@]}"; do
  command grep -q "<ID>$id</ID>" "$work/stored.xml" || { echo "garage-lifecycle: rule $id was not stored" >&2; exit 1; }
done
echo "GARAGE-LIFECYCLE-OK $S3_BUCKET_PRIVATE: uploads/ ${UPLOADS_EXPIRE_DAYS} d, exports/ ${EXPORTS_EXPIRE_DAYS} d, incomplete multipart ${ABORT_MULTIPART_DAYS} d"
if [[ "${GARAGE_LIFECYCLE_PRINT:-}" == 1 ]]; then
  command cat "$work/stored.xml"
fi
