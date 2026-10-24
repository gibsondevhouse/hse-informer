#!/bin/sh
set -eu
beta_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
beta_root=$(CDPATH= cd -- "$beta_dir/../../.." && pwd)
: "${BETA_ENV_FILE:?Set the one private env file path outside the repository}"
python3 "$beta_dir/prepare.py" validate --env-file "$BETA_ENV_FILE"
beta_repository=$(python3 "$beta_dir/prepare.py" value --env-file "$BETA_ENV_FILE" --key BETA_IMAGE_REPOSITORY)
beta_tag=$(python3 "$beta_dir/prepare.py" value --env-file "$BETA_ENV_FILE" --key BETA_IMAGE_TAG)
if [ "$(git -C "$beta_root" rev-parse HEAD)" != "$beta_tag" ] || [ -n "$(git -C "$beta_root" status --porcelain)" ]; then
  echo 'Build from the clean reviewed commit named in BETA_IMAGE_TAG.' >&2
  exit 1
fi
docker build --file "$beta_root/infra/moodle/Dockerfile" --tag "$beta_repository:$beta_tag-moodle-base" "$beta_root/infra/moodle"
docker build --file "$beta_root/web/Dockerfile" --target runtime --tag "$beta_repository:$beta_tag" "$beta_root"
docker build --file "$beta_root/web/Dockerfile" --target tools --tag "$beta_repository:$beta_tag-tools" "$beta_root"
docker build --file "$beta_dir/Moodle.Dockerfile" --build-arg "MOODLE_BASE_IMAGE=$beta_repository:$beta_tag-moodle-base" --tag "$beta_repository:$beta_tag-moodle" "$beta_root"
docker build --file "$beta_dir/Recovery.Dockerfile" --tag "$beta_repository:$beta_tag-recovery" "$beta_root"
echo 'Images prepared. No services were started or published.'
