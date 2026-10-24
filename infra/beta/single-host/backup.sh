#!/bin/sh
set -eu
beta_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
: "${BETA_ENV_FILE:?Set the one private env file path}"
beta_destination=${1:?Usage: backup.sh /absolute/protected/directory}
case "$beta_destination" in /*) ;; *) echo 'Use an absolute protected backup directory.' >&2; exit 1;; esac
python3 "$beta_dir/prepare.py" validate --env-file "$BETA_ENV_FILE" --mode backup
compose() { docker compose --env-file "$BETA_ENV_FILE" -f "$beta_dir/compose.yaml" "$@"; }
beta_services=$(compose --profile operations ps --status running --services)
for beta_service in web moodle keycloak; do
  if ! printf '%s\n' "$beta_services" | grep -qx "$beta_service"; then echo "Start and verify $beta_service before backing up this stack." >&2; exit 1; fi
done
mkdir -p "$beta_destination"
chmod 700 "$beta_destination"
beta_work=$(mktemp -d)
chmod 700 "$beta_work"
finish() {
  beta_status=$?
  rm -rf "$beta_work"
  for beta_service in web moodle keycloak jobs; do
    if printf '%s\n' "$beta_services" | grep -qx "$beta_service"; then
      compose --profile operations start "$beta_service" >/dev/null || beta_status=1
    fi
  done
  exit "$beta_status"
}
trap finish EXIT
# Stop the complete set of writers; PostgreSQL remains available to the backup
# container on its private network. Only previously running services restart.
compose --profile operations stop web jobs keycloak moodle
mkdir -p "$beta_work/moodlecode"
compose cp moodle:/var/www/moodle/. "$beta_work/moodlecode/"
beta_file="hse-beta-$(date -u +%Y%m%dT%H%M%SZ).tar.age"
compose --profile backup run --rm --no-deps \
  --volume "$beta_work/moodlecode:/backup-input/moodlecode:ro" \
  --volume "$beta_destination:/output" recovery backup --output "/output/$beta_file"
echo "Encrypted recovery archive saved: $beta_destination/$beta_file"
