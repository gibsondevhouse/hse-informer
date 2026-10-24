#!/bin/sh
set -eu
beta_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
: "${BETA_ENV_FILE:?Set the absolute host-secret env file path}"
: "${BETA_STATE_DIR:?Set a protected host state directory outside the checkout}"
mkdir -p "$BETA_STATE_DIR"
chmod 700 "$BETA_STATE_DIR"
beta_mode=${1:?Usage: deploy.sh IMAGE_TAG or deploy.sh --rollback}
beta_previous=$(cat "$BETA_STATE_DIR/current-image" 2>/dev/null || true)
if [ "$beta_mode" = "--rollback" ]; then
  beta_tag=$(cat "$BETA_STATE_DIR/previous-image")
else
  beta_tag=$beta_mode
fi
case "$beta_tag" in ''|*[!a-zA-Z0-9_.-]*) echo 'Invalid image tag' >&2; exit 1;; esac
export BETA_IMAGE_TAG=$beta_tag
compose() { docker compose --env-file "$BETA_ENV_FILE" -f "$beta_dir/compose.yaml" "$@"; }
on_error() {
  beta_status=$?
  if [ "$beta_status" -ne 0 ]; then
    node "$beta_dir/notify.mjs" hse.deploy.failed || true
    echo 'Deployment failed; inspect host logs. Previous image state remains available.' >&2
  fi
}
trap on_error EXIT
compose config --quiet
compose pull
if [ "$beta_mode" != "--rollback" ]; then
  compose run --rm --no-deps migrate
fi
compose up -d --no-deps --wait --wait-timeout 120 web
compose up -d --no-deps jobs
if [ -n "$beta_previous" ] && [ "$beta_previous" != "$beta_tag" ]; then
  printf '%s\n' "$beta_previous" > "$BETA_STATE_DIR/previous-image"
fi
printf '%s\n' "$beta_tag" > "$BETA_STATE_DIR/current-image"
echo "Application image is healthy: $beta_tag"
