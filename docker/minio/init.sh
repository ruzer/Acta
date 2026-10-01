#!/bin/sh
set -eu
# Credentials are confined to this short-lived provisioning container.
export MC_CONFIG_DIR=/tmp/mc
export MC_UPDATE=off
export MINIO_UPDATE=off
root_user="$(cat /run/provision-secrets/root-user)"
root_password="$(cat /run/provision-secrets/root-password)"
access="$(cat /run/provision-secrets/access)"
secret="$(cat /run/provision-secrets/secret)"
run_mc() {
  step="$1"
  shift
  if ! mc "$@" >/dev/null 2>&1; then
    printf '%s failed; credentials and command arguments omitted.\n' "$step" >&2
    exit 1
  fi
}
case "$S3_BUCKET" in ''|*[!a-z0-9.-]*) echo 'Invalid bucket name'; exit 1;; esac
run_mc "Storage authentication" alias set -- private http://minio:9000 "$root_user" "$root_password"
run_mc "Bucket initialization" mb --ignore-existing "private/$S3_BUCKET"
run_mc "Private bucket policy" anonymous set none "private/$S3_BUCKET"
cat > /tmp/evidence-policy.json <<POLICY
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetBucketLocation","s3:ListBucket"],"Resource":["arn:aws:s3:::$S3_BUCKET"]},{"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::$S3_BUCKET/evidence/v1/*"]}]}
POLICY
run_mc "Application account" admin user add -- private "$access" "$secret"
run_mc "Application policy" admin policy create private evidence-app /tmp/evidence-policy.json
run_mc "Application policy binding" admin policy attach private evidence-app "--user=$access"
run_mc "Bucket verification" stat "private/$S3_BUCKET"
rm -rf /tmp/mc /tmp/evidence-policy.json
printf 'Private evidence bucket and scoped application account ready.\n'
