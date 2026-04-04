FROM node:22-alpine AS build
WORKDIR /app

# Install Java 21 (required by openapi-generator-cli)
RUN apk add --no-cache openjdk21-jre-headless

# Copy OpenAPI spec to match relative path used by api:generate (../api/openapi.yaml)
COPY api/openapi.yaml /api/openapi.yaml

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm install --legacy-peer-deps

# Copy source and build
COPY frontend/ .
RUN --mount=type=cache,target=/root/.npm npm run api:generate && npm run build

FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
