# Recurring Payments Tracker

A web application that analyzes bank CSV exports to identify recurring payments and provides an annual overview dashboard with predictions and budget insights.

## Features

- **CSV Import** -- Upload German/Austrian bank CSV exports (semicolon-delimited, European date/number formats)
- **Recurring Payment Detection** -- Fuzzy matching on partner names with interval detection (monthly, quarterly, yearly)
- **Annual Dashboard** -- Monthly income vs. expenses bar chart, spending-by-category pie chart, summary cards
- **Predictions** -- Upcoming payment forecasts for the next 6 months
- **Category Management** -- Organize recurring payments into custom categories

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend  | Angular 19, Tailwind CSS, Chart.js (ng2-charts) |
| Backend   | Java 21, Spring Boot 3.4, Maven |
| Database  | PostgreSQL 15 |
| API       | OpenAPI 3.0.3 (code-generated for both frontend and backend) |

## Project Structure

```
api/          OpenAPI 3.0.3 specification (single source of truth)
backend/      Spring Boot application (Maven)
frontend/     Angular 19 application
```

## Getting Started

### Prerequisites

- **Java 21+** and **Maven 3.9+**
- **Node.js 22+** and **npm**
- **Docker** and **Docker Compose** (for database or full deployment)

### Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start PostgreSQL:**
   ```bash
   npm run db:start
   ```

3. **Start the backend** (runs on port 8080):
   ```bash
   npm run backend:start
   ```

4. **Start the frontend** (runs on port 4200):
   ```bash
   npm run frontend:start
   ```

Or start everything at once:
```bash
npm run dev
```

### Git Hooks

The repository includes a pre-commit hook that runs `ng lint` on staged frontend files. Install it after cloning:

```bash
bash tooling/install-hooks.sh
```

The hook automatically skips linting if the commit does not touch any files under `frontend/`.

### Sonar Analysis

The monorepo is configured as two Sonar projects:

- Backend: `Recurring-Payment-Tracker-Backend`
- Frontend: `Recurring-Payments-Tracker-Frontend`

Each project has its own checked-in `runSonar.sh` script. Tokens are intentionally not stored in the scripts or committed to git. Create a local ignored env file for each project:

```bash
cp backend/sonar.env.example backend/sonar.env
cp frontend/sonar.env.example frontend/sonar.env
```

Then set `SONAR_HOST_URL` and the real `SONAR_TOKEN` in each `sonar.env`. The scripts fail fast if either value is missing.

Run backend analysis with JaCoCo coverage:

```bash
cd backend
./runSonar.sh
```

The backend script runs `mvn clean verify`, generates `target/site/jacoco/jacoco.xml`, and passes that report to Sonar.

Run frontend analysis with Jest LCOV coverage:

```bash
cd frontend
./runSonar.sh
```

The frontend script runs Jest with coverage, generates `coverage/lcov.info`, and passes that report to Sonar. Generated frontend API client code is excluded from frontend coverage and analysis.

Do not commit `sonar.env`, `.scannerwork/`, `coverage/`, or `target/`; these are ignored by git.

### Docker Deployment

Run the full stack with Docker Compose:

```bash
# Copy and customize environment variables
cp .env.example .env

# Build all services
./build.sh

# Build and start all services in detached mode
./build.sh up
```

The build script enables BuildKit with cache mounts for Maven and npm dependencies, so subsequent builds only download new or changed dependencies.

Set the deployment-specific values in `.env`, especially:

- `APP_HOSTNAME` for the public DNS name
- `APP_CORS_ALLOWED_ORIGINS` for the frontend origin allowed by Spring Security
- `APP_HTTP_PORT` and `APP_HTTPS_PORT` for the published host ports
- `CERTS_DIR`, `SSL_CERTIFICATE_FILE`, and `SSL_CERTIFICATE_KEY_FILE` for the mounted certificate files nginx should use

`CERTS_DIR` is the host directory mounted into `/etc/nginx/certs`, and the certificate env vars are just filenames inside that directory.

The application will then be available at `https://<APP_HOSTNAME>` on the published ports from `.env`.

| Service  | Port |
|----------|------|
| Frontend | `APP_HTTP_PORT` / `APP_HTTPS_PORT` |
| Backend  | 8080 |
| Database | 5432 |

Ports and credentials can be configured via environment variables in `.env`.

### Code Generation

Both backend and frontend code is generated from the OpenAPI spec:

```bash
# Backend (Spring interfaces + DTOs)
cd backend && mvn generate-sources

# Frontend (Angular services + TypeScript models)
cd frontend && npm run api:generate
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all services (database, backend, frontend) |
| `npm run db:start` | Start PostgreSQL container |
| `npm run backend:start` | Start Spring Boot backend |
| `npm run frontend:start` | Start Angular dev server |
| `npm run frontend:build` | Build Angular for production |
| `./build.sh` | Build Docker images with dependency caching |
| `./build.sh up` | Build and start all services in detached mode |

## CSV Format

The application accepts CSV files with the following format:

- **Delimiter:** `;` (semicolon)
- **Date format:** `DD.MM.YYYY`
- **Number format:** European (`-12,99` = -12.99)
- **Required columns:** `Buchungsdatum`, `Partnername`, `Betrag`
- **Optional columns:** `Buchungs-Details`, `Partner IBAN`

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
