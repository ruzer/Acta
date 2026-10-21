# Versity Gateway v1.8.0, built from the official source (Apache-2.0) at the exact commit the
# tag points to, with Go 1.27.2 and golang.org/x/net v0.60.0 (see UPSTREAM-MODIFICATIONS).
# The official image ships Go 1.27.1 and x/net v0.58.0, which govulncheck reports. The Go image
# is pinned by digest; the source by commit hash (verified); dependencies by go.sum.
# Keep this stage identical in app/backend/Dockerfile so the build cache is shared.
FROM golang:1.27.2-bookworm@sha256:5cf287a799e6b94384bad13d16b14904c531f51ba65792237e122ce42b392f61 AS versitygw-build
ARG VERSITYGW_COMMIT=fd04bc1df2656298577b82667a4195c77f8c7563
WORKDIR /src
RUN git init -q . \
    && git fetch -q --depth 1 https://github.com/versity/versitygw.git "$VERSITYGW_COMMIT" \
    && git checkout -q FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "$VERSITYGW_COMMIT"
COPY docker/versity/versitygw-v1.8.0-security.patch /tmp/security.patch
RUN git apply --check /tmp/security.patch && git apply /tmp/security.patch
ENV CGO_ENABLED=0 GOFLAGS=-mod=readonly GOTOOLCHAIN=local
RUN go mod verify \
    && cd cmd/versitygw \
    && go build -trimpath -buildvcs=false \
       -ldflags "-X=main.Build=${VERSITYGW_COMMIT} -X=main.BuildTime=2026-09-04T20:21:34Z -X=main.Version=v1.8.0" \
       -o /out/versitygw
FROM node:24.21.0-bookworm-slim
COPY --from=versitygw-build /out/versitygw /usr/local/bin/versitygw
COPY docker/versity/UPSTREAM-LICENSE docker/versity/UPSTREAM-NOTICE docker/versity/UPSTREAM-MODIFICATIONS /usr/share/licenses/versitygw/
COPY docker/versity/start.mjs /opt/start.mjs
RUN mkdir -p /data && chown node:node /data
USER node
ENTRYPOINT ["node", "/opt/start.mjs"]
