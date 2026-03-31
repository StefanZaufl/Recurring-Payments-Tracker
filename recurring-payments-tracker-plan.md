# Recurring Payments Tracker — Implementation Plan

## Project Overview

A web application that analyzes bank CSV exports to identify recurring payments and provides an annual overview dashboard with predictions and budget insights.

---

## Requirements Summary

### Functional Requirements

1. **CSV Import & Parsing**
   - Accept German/Austrian bank CSV exports
   - Delimiter: `;` (semicolon)
   - Date format: `DD.MM.YYYY`
   - Number format: European (`-12,99` = -12.99)
   - Relevant columns: `Buchungsdatum`, `Partnername`, `Betrag`, `Buchungs-Details`

2. **Recurring Payment Detection**
   - Fuzzy matching on `Partnername` to group similar transactions
   - Interval detection (monthly, quarterly, yearly) based on transaction dates
   - Distinguish between income (positive amounts) and expenses (negative amounts)

3. **Annual Overview Dashboard**
   - Monthly breakdown per subscription/recurring payment
   - Total annual cost per category
   - Visual charts (pie chart for categories, bar chart for monthly spending)
   - Upcoming payment predictions (next 3-6 months)
   - Monthly surplus calculation (income − recurring expenses)

4. **Data Persistence**
   - Store uploaded transactions in PostgreSQL
   - Store detected recurring payment patterns
   - Allow manual corrections/categorization (future enhancement)

### Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | Angular 19+, Angular CLI, ng2-charts (Chart.js), Tailwind CSS |
| Backend | Java 21+, Spring Boot 3.4.x, Maven |
| Database | PostgreSQL 15+ |
| API | OpenAPI 3.0.3 (single source of truth), RESTful JSON |
| API Code Generation | openapi-generator-maven-plugin (backend), @openapitools/openapi-generator-cli (frontend) |

### Monorepo Structure

This project is structured as a monorepo with the following top-level directories:

| Directory | Description |
|-----------|-------------|
| `api/` | OpenAPI 3.0.3 specification (`openapi.yaml`) — the single source of truth for all API endpoints and DTOs |
| `backend/` | Spring Boot application (Maven). JPA entities, repositories, services, and controllers that implement the generated API interfaces. Flyway migrations manage the database schema. |
| `frontend/` | Angular 19 application (npm workspace). Feature components for dashboard, file upload, recurring payments, and predictions. Services and models are generated from the OpenAPI spec. |

Root-level files: `package.json` (monorepo scripts), `docker-compose.yml` (PostgreSQL + services), `.gitignore`.

---

## Database Schema

See [`backend/src/main/resources/db/migration/`](backend/src/main/resources/db/migration/) for the Flyway migration files.

**Tables:**
- `file_uploads` — Uploaded file metadata (filename, mime_type, row_count)
- `transactions` — Raw transactions parsed from CSV (booking_date, partner_name, amount, details, etc.)
- `categories` — Categories for grouping recurring payments (name, hex color)
- `recurring_payments` — Detected recurring payment patterns (name, frequency, average_amount, is_income)
- `transaction_recurring_link` — Links transactions to recurring payments with a confidence score

---

## API Endpoints

> **Single source of truth:** All API endpoints, request/response schemas, and DTOs are defined in [`api/openapi.yaml`](api/openapi.yaml).
> Both backend (Spring interfaces + DTOs) and frontend (Angular services + models) are generated from this spec.

### Summary

| Method | Path | Operation | Tag |
|--------|------|-----------|-----|
| POST | `/api/transactions/csv` | uploadCsv | Transactions |
| GET | `/api/transactions` | getTransactions | Transactions |
| GET | `/api/transactions/{id}` | getTransactionById | Transactions |
| GET | `/api/recurring-payments` | getRecurringPayments | RecurringPayments |
| PUT | `/api/recurring-payments/{id}` | updateRecurringPayment | RecurringPayments |
| GET | `/api/recurring-payments/{id}/transactions` | getRecurringPaymentTransactions | RecurringPayments |
| GET | `/api/analytics/annual-overview` | getAnnualOverview | Analytics |
| GET | `/api/analytics/predictions` | getPredictions | Analytics |

### Code Generation

**Backend (Maven):** `cd backend && mvn generate-sources` — generates Spring interfaces and DTOs in `target/generated-sources/openapi`. Controllers implement the generated API interfaces.

**Frontend (npm):** `cd frontend && npm run api:generate` — generates Angular services and TypeScript models in `src/app/api/generated/`.

---

## Implementation Phases

### Phase 1: Project Setup & Database
1. Initialize Spring Boot project with dependencies (Web, JPA, PostgreSQL, Flyway)
2. Create database schema with Flyway migrations
3. Set up entity classes and repositories
4. Configure Docker Compose for PostgreSQL
5. Initialize Angular project with Angular CLI + Tailwind
6. Create OpenAPI 3.0.3 spec (`api/openapi.yaml`) as single source of truth
7. Configure `openapi-generator-maven-plugin` for backend API interface + DTO generation
8. Configure `@openapitools/openapi-generator-cli` for frontend Angular service + model generation

### Phase 2: CSV Import
1. Implement CSV parser for German bank format
2. Handle encoding (UTF-8, ISO-8859-1)
3. Parse European date and number formats
4. Create upload endpoint with validation
5. Store transactions in database
6. Build file upload component in Angular

### Phase 3: Recurring Payment Detection
1. Implement string similarity algorithm (Levenshtein/Jaro-Winkler)
2. Group transactions by normalized partner name
3. Detect payment intervals (analyze date gaps)
4. Calculate average amounts and predict next dates
5. Store recurring payment patterns

### Phase 4: Dashboard & Visualization
1. Implement annual overview API
2. Calculate monthly breakdown
3. Build category aggregation
4. Create prediction logic
5. Build Angular dashboard with ng2-charts (Chart.js):
   - Pie chart: spending by category
   - Bar chart: monthly income vs expenses
   - Table: recurring payments list
   - Cards: monthly surplus

### Phase 5: Polish & Deployment
1. Error handling and validation
2. Loading states and UX improvements
3. Dockerize frontend and backend
4. Create production docker-compose
5. Add README with setup instructions

---

## Key Algorithms

### String Similarity for Matching
- Use Jaro-Winkler similarity for partner name matching (threshold: 0.85)
- Normalize strings: lowercase, remove special chars, trim
- Returns score 0.0–1.0

### Interval Detection
- Analyze day gaps between consecutive transactions for the same partner
- Median gap ~30 days -> MONTHLY
- Median gap ~90 days -> QUARTERLY
- Median gap ~365 days -> YEARLY

### Next Payment Prediction
- Based on detected frequency and last payment date
- MONTHLY: `lastPayment + 1 month`
- QUARTERLY: `lastPayment + 3 months`
- YEARLY: `lastPayment + 1 year`

---

## Configuration

- **Backend:** See [`backend/src/main/resources/application.yml`](backend/src/main/resources/application.yml) for Spring Boot, datasource, Flyway, and multipart upload config.
- **Docker Compose:** See [`docker-compose.yml`](docker-compose.yml) for PostgreSQL, backend, and frontend service definitions.
- **Backend dependencies:** See [`backend/pom.xml`](backend/pom.xml) (includes openapi-generator-maven-plugin).
- **Frontend dependencies:** See [`frontend/package.json`](frontend/package.json) (includes @openapitools/openapi-generator-cli).

---

## Getting Started

1. **Install dependencies:** `npm install` (installs root + workspace dependencies)
2. **Start PostgreSQL:** `npm run db:start`
3. **Run backend:** `npm run backend:start`
4. **Run frontend:** `npm run frontend:start`
5. **Or run everything:** `npm run dev`

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all services (db, backend, frontend) |
| `npm run db:start` | Start PostgreSQL container |
| `npm run backend:start` | Start Spring Boot backend |
| `npm run frontend:start` | Start Angular dev server |
| `npm run frontend:build` | Build Angular for production |
| `cd frontend && npm run api:generate` | Regenerate frontend API code from OpenAPI spec |
| `cd backend && mvn generate-sources` | Regenerate backend API interfaces from OpenAPI spec |

---

## Future Enhancements
- Manual categorization UI
- Export reports as PDF
- Multiple account support
- Budget setting and alerts
- Bank connection via FinTS/PSD2
