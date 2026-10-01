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
FROM versity/versitygw:v1.8.0@sha256:30292fc2eeacc67a36993b01f7a7a5e3361a19cced0e80c1d71cfa2a4b0a2499 AS storage-binary
FROM runtime AS storage-init
COPY --from=storage-binary /usr/local/bin/versitygw /opt/versitygw
COPY docker/versity/UPSTREAM-LICENSE docker/versity/UPSTREAM-NOTICE /usr/share/licenses/versitygw/
ENTRYPOINT ["node", "scripts/init-object-storage.mjs"]
