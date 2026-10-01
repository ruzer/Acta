FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY app/backend/package.json app/backend/package.json
COPY app/frontend/package.json app/frontend/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build -w @requirements/contracts && npm run build -w @requirements/frontend
FROM nginxinc/nginx-unprivileged:1.30.5-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
