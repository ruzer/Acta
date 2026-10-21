# Official Versity Gateway v1.9.0 (Apache-2.0), unmodified source and dependencies.
# Pin the Go security update by digest and the release source by verified commit.
# Keep this stage identical in app/backend/Dockerfile so the build cache is shared.
FROM golang:1.27.3-bookworm@sha256:5c3e9b43cfd3bb95c7937462e29d87ada57b481a96fa23ad0eb61778d7a00110 AS versitygw-build
ARG VERSITYGW_COMMIT=ca4c8d30f579a5ac3dd8c91bbfa8340c69dac0ac
WORKDIR /src
RUN git init -q . \
    && git fetch -q --depth 1 https://github.com/versity/versitygw.git "$VERSITYGW_COMMIT" \
    && git checkout -q FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "$VERSITYGW_COMMIT"
ENV CGO_ENABLED=0 GOFLAGS=-mod=readonly GOTOOLCHAIN=local
RUN go mod verify \
    && cd cmd/versitygw \
    && go build -trimpath -buildvcs=false \
       -ldflags "-X=main.Build=${VERSITYGW_COMMIT} -X=main.BuildTime=2026-10-13T22:33:19Z -X=main.Version=v1.9.0" \
       -o /out/versitygw
FROM node:24.21.0-bookworm-slim
COPY --from=versitygw-build /out/versitygw /usr/local/bin/versitygw
COPY docker/versity/UPSTREAM-LICENSE docker/versity/UPSTREAM-NOTICE docker/versity/UPSTREAM-MODIFICATIONS /usr/share/licenses/versitygw/
COPY docker/versity/start.mjs /opt/start.mjs
RUN mkdir -p /data && chown node:node /data
USER node
ENTRYPOINT ["node", "/opt/start.mjs"]
