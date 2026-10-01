# Verified upstream release; copy the binary, not its broken ARM64 shell layer.
FROM versity/versitygw:v1.8.0@sha256:30292fc2eeacc67a36993b01f7a7a5e3361a19cced0e80c1d71cfa2a4b0a2499 AS upstream
FROM node:24.21.0-bookworm-slim
COPY --from=upstream /usr/local/bin/versitygw /usr/local/bin/versitygw
COPY docker/versity/UPSTREAM-LICENSE docker/versity/UPSTREAM-NOTICE /usr/share/licenses/versitygw/
COPY docker/versity/start.mjs /opt/start.mjs
RUN mkdir -p /data && chown node:node /data
USER node
ENTRYPOINT ["node", "/opt/start.mjs"]
