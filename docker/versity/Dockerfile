# Official Versity Gateway v1.11.0 (Apache-2.0), unmodified source and dependencies.
# Pin the Go security update by digest and the release source by verified commit.
# Keep this stage identical in app/backend/Dockerfile so the build cache is shared.
FROM golang:1.27.3-bookworm@sha256:dc0963f32053e4bc451d24d87e3892d42d01021b61f093e98eb95c0352bb84b0 AS versitygw-build
ARG VERSITYGW_COMMIT=e42ae7ab8107201e64e52ee024824e8cab3683b3
WORKDIR /src
RUN git init -q . \
    && git fetch -q --depth 1 https://github.com/versity/versitygw.git "$VERSITYGW_COMMIT" \
    && git checkout -q FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "$VERSITYGW_COMMIT"
ENV CGO_ENABLED=0 GOFLAGS=-mod=readonly GOTOOLCHAIN=local
RUN go mod verify \
    && cd cmd/versitygw \
    && go build -trimpath -buildvcs=false \
       -ldflags "-X=main.Build=${VERSITYGW_COMMIT} -X=main.BuildTime=2026-11-06T22:51:18Z -X=main.Version=v1.11.0" \
       -o /out/versitygw
FROM node:26.13.0-bookworm-slim
COPY --from=versitygw-build /out/versitygw /usr/local/bin/versitygw
COPY docker/versity/UPSTREAM-LICENSE docker/versity/UPSTREAM-NOTICE docker/versity/UPSTREAM-MODIFICATIONS /usr/share/licenses/versitygw/
COPY docker/versity/start.mjs /opt/start.mjs
RUN mkdir -p /data && chown node:node /data
USER node
ENTRYPOINT ["node", "/opt/start.mjs"]
