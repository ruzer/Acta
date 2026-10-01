#!/bin/sh
# Run inside the Dockerfile build target; never mount installation secrets here.
set -eu
go install golang.org/x/vuln/cmd/govulncheck@v1.8.0
result=0
for binary in /go/bin/minio /go/bin/mc; do
  printf '\nAnalyzing %s\n' "$binary"
  if /go/bin/govulncheck -mode=binary "$binary"; then
    :
  else
    result=1
  fi
done
exit "$result"
