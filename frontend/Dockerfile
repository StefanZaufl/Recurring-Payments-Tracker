FROM node:22-alpine AS build
WORKDIR /app

# Copy OpenAPI spec (needed for api:generate)
COPY api/openapi.yaml /app/api/openapi.yaml

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy source and build
COPY frontend/ .
RUN npm run api:generate && npm run build

FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
