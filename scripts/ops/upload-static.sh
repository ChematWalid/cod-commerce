#!/usr/bin/env bash
# Copies the storefront's static files out of a built role image to the public-assets R2 bucket, at the key the
# image's assetPrefix points to: STOREFRONT_ASSET_PREFIX=https://cdn.<base>/sf → s3://<bucket>/sf/_next/static/
# (infra/modules/r2: the bucket's custom domain is cdn.<base>). R2 holds public assets only (ADR 0012).
# Run by .github/workflows/image.yml after the push (D3505).
#
#   IMAGE=<ref> STOREFRONT_ASSET_PREFIX=<same value as the build arg> \
#   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_ASSETS_BUCKET=… scripts/ops/upload-static.sh
#
# Skips with a notice (exit 0) while the R2 secrets are absent or the image has no CDN prefix (static files are then
# served by the storefront itself). Files are content-hashed and never deleted: pages of the previous deployment
# keep loading their own chunks during and after a rollout. Never add `set -x`: it would print the keys.
set -euo pipefail

readonly EX_USAGE=64
readonly IMAGE_STATIC_DIR=/app/apps/storefront/.next/standalone/apps/storefront/.next/static
# https://host[/path…]: no query, no trailing slash; the path becomes the key prefix.
readonly PREFIX_FORMAT='^https://[A-Za-z0-9.-]+((/[A-Za-z0-9._-]+)*)$'

notice() { echo "::notice title=storefront static files not uploaded::$*"; }

if [[ -z "${R2_ACCOUNT_ID:-}" || -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" || -z "${R2_ASSETS_BUCKET:-}" ]]; then
  notice "the R2 secrets (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) or the R2_ASSETS_BUCKET variable are not set."
  exit 0
fi
if [[ -z "${STOREFRONT_ASSET_PREFIX:-}" ]]; then
  notice "the image was built without STOREFRONT_ASSET_PREFIX, so the storefront serves its own static files."
  exit 0
fi
if [[ ! "$STOREFRONT_ASSET_PREFIX" =~ $PREFIX_FORMAT ]]; then
  echo "upload-static: STOREFRONT_ASSET_PREFIX must be https://host[/path] with no query or trailing slash" >&2
  exit "$EX_USAGE"
fi
key_prefix=${BASH_REMATCH[1]#/}
: "${IMAGE:?upload-static: set IMAGE to the built role image}"
command -v aws >/dev/null || { echo "upload-static: the aws CLI is missing (preinstalled on GitHub runners)" >&2; exit 1; }

work=$(mktemp -d)
container=''
cleanup() {
  [[ -z "$container" ]] || docker rm "$container" >/dev/null
  rm -rf "$work"
}
trap cleanup EXIT

container=$(docker create "$IMAGE")
docker cp "$container:$IMAGE_STATIC_DIR" "$work/static"

destination="s3://$R2_ASSETS_BUCKET/${key_prefix:+$key_prefix/}_next/static/"
AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY AWS_DEFAULT_REGION=auto \
  AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
  aws s3 cp "$work/static" "$destination" --recursive --only-show-errors \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" \
  --cache-control 'public, max-age=31536000, immutable'
echo "upload-static: $(find "$work/static" -type f | wc -l) files → $destination"
