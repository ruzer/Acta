FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY app/backend/package.json app/backend/package.json
COPY app/frontend/package.json app/frontend/package.json
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://unused:unused@localhost/unused npm run prisma:generate && npm run build -w @requirements/contracts && npm run build -w @requirements/backend
FROM node:24.21.0-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/
COPY --from=build --chown=node:node /app/packages/contracts/package.json /app/packages/contracts/package.json
COPY --from=build --chown=node:node /app/packages/contracts/dist /app/packages/contracts/dist
COPY --from=build --chown=node:node /app/app/backend/package.json /app/app/backend/prisma.config.ts /app/app/backend/
COPY --from=build --chown=node:node /app/app/backend/dist /app/app/backend/dist
COPY --from=build --chown=node:node /app/app/backend/prisma /app/app/backend/prisma
COPY --from=build --chown=node:node /app/scripts /app/scripts
RUN mkdir -p /app/.private-evidence && chown node:node /app/.private-evidence
USER node
EXPOSE 3000
CMD ["sh", "scripts/start-backend.sh"]

# Provisioning credentials/binary never enter the application runtime image.
# Official Versity Gateway v1.9.0 (Apache-2.0), unmodified source and dependencies.
# Pin the Go security update by digest and the release source by verified commit.
# Keep this stage identical in docker/versity/Dockerfile so the build cache is shared.
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
FROM runtime AS storage-init
COPY --from=versitygw-build /out/versitygw /opt/versitygw
COPY docker/versity/UPSTREAM-LICENSE docker/versity/UPSTREAM-NOTICE docker/versity/UPSTREAM-MODIFICATIONS /usr/share/licenses/versitygw/
ENTRYPOINT ["node", "scripts/init-object-storage.mjs"]
