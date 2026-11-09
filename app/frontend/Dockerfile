FROM node:26.13.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY app/backend/package.json app/backend/package.json
COPY app/frontend/package.json app/frontend/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build -w @requirements/contracts && npm run build -w @requirements/frontend
FROM nginxinc/nginx-unprivileged:1.30.6-alpine
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --chmod=755 docker/19-trusted-proxies.envsh /docker-entrypoint.d/19-trusted-proxies.envsh
COPY --from=build /app/app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
