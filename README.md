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

### Docker Deployment

Run the full stack with Docker Compose:

```bash
# Copy and customize environment variables
cp .env.example .env

# Build and start all services
docker compose up --build
```

The application will be available at `http://localhost:3000`.

| Service  | Port |
|----------|------|
| Frontend | 3000 |
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

## CSV Format

The application accepts CSV files with the following format:

- **Delimiter:** `;` (semicolon)
- **Date format:** `DD.MM.YYYY`
- **Number format:** European (`-12,99` = -12.99)
- **Required columns:** `Buchungsdatum`, `Partnername`, `Betrag`
- **Optional columns:** `Buchungs-Details`, `Partner IBAN`

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
