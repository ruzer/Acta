# Upstream Community is source-only. Keep source and AGPL license with the build.
FROM golang:1.26.8-bookworm AS build
ENV CGO_ENABLED=0
RUN go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z
RUN go install github.com/minio/mc@RELEASE.2025-08-13T08-35-41Z
RUN mkdir /licenses \
    && cp "$(go list -m -f '{{.Dir}}' github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z)/LICENSE" /licenses/MINIO-LICENSE \
    && cp "$(go list -m -f '{{.Dir}}' github.com/minio/mc@RELEASE.2025-08-13T08-35-41Z)/LICENSE" /licenses/MC-LICENSE
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/* && mkdir /data && chown 1000:1000 /data
COPY --from=build /go/bin/minio /go/bin/mc /usr/local/bin/
COPY --from=build /licenses /usr/share/licenses/minio
COPY docker/minio/start.sh docker/minio/init.sh /opt/
USER 1000:1000
ENTRYPOINT ["sh", "/opt/start.sh"]
