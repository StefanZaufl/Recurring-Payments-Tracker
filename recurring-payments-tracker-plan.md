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
| Backend | Java 24+, Spring Boot 3.4.x, Maven |
| Database | PostgreSQL 15+ |
| API | RESTful JSON API |

### Monorepo Setup

This project is structured as a monorepo with both frontend and backend in a single repository.

**Root `package.json`** (for monorepo tooling):
```json
{
  "name": "recurring-payments-tracker",
  "private": true,
  "workspaces": [
    "frontend"
  ],
  "scripts": {
    "frontend": "npm --workspace=frontend",
    "frontend:start": "npm --workspace=frontend run start",
    "frontend:build": "npm --workspace=frontend run build",
    "backend:start": "cd backend && ./mvnw spring-boot:run",
    "db:start": "docker-compose up -d db",
    "dev": "concurrently \"npm run db:start\" \"npm run backend:start\" \"npm run frontend:start\""
  },
  "devDependencies": {
    "concurrently": "^8.x"
  }
}
```

**Directory layout:**
```
recurring-payments-tracker/
├── package.json          # Root package.json for monorepo scripts
├── package-lock.json
├── .gitignore
├── README.md
├── docker-compose.yml
├── backend/              # Spring Boot application (Maven)
│   ├── pom.xml
│   └── src/
└── frontend/             # Angular application (npm workspace)
    ├── package.json
    └── src/
```

**Initialize the monorepo:**
```bash
# 1. Create root directory
mkdir recurring-payments-tracker && cd recurring-payments-tracker

# 2. Initialize root package.json
npm init -y
npm pkg set private=true
npm pkg set workspaces='["frontend"]'
npm install -D concurrently

# 3. Create backend with Spring Initializr
# Visit https://start.spring.io or use:
curl https://start.spring.io/starter.zip \
  -d type=maven-project \
  -d language=java \
  -d bootVersion=3.4.4 \
  -d baseDir=backend \
  -d groupId=com.tracker \
  -d artifactId=recurring-payments-tracker \
  -d name=RecurringPaymentsTracker \
  -d packageName=com.tracker \
  -d javaVersion=24 \
  -d dependencies=web,data-jpa,postgresql,flyway,lombok \
  -o backend.zip && unzip backend.zip && rm backend.zip

# 4. Create frontend with Angular CLI
ng new frontend --style=css --routing=true --ssr=false
cd frontend && npm install ng2-charts chart.js && cd ..

# 5. Add Tailwind to Angular
cd frontend
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
cd ..

# 6. Initialize git
git init
echo "node_modules/\ntarget/\n.idea/\n*.iml\n.DS_Store\ndist/" > .gitignore
```

---

## Database Schema

```sql
-- Uploaded file metadata
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    row_count INTEGER
);

-- Raw transactions from CSV
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    partner_name VARCHAR(255),
    partner_iban VARCHAR(34),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories for grouping (must be created before recurring_payments)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) -- Hex color for charts
);

-- Detected recurring payment patterns
CREATE TABLE recurring_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    average_amount DECIMAL(12,2),
    frequency VARCHAR(20), -- 'MONTHLY', 'QUARTERLY', 'YEARLY'
    is_income BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link transactions to recurring payments
CREATE TABLE transaction_recurring_link (
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    recurring_payment_id UUID REFERENCES recurring_payments(id) ON DELETE CASCADE,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    PRIMARY KEY (transaction_id, recurring_payment_id)
);

-- Index for performance
CREATE INDEX idx_transactions_booking_date ON transactions(booking_date);
CREATE INDEX idx_transactions_partner_name ON transactions(partner_name);
CREATE INDEX idx_transactions_details ON transactions(details);
CREATE INDEX idx_recurring_payments_name ON recurring_payments(normalized_name);
CREATE INDEX idx_recurring_payments_category ON recurring_payments(category_id);
```

---

## API Endpoints

### CSV Upload
```
POST /api/transactions/csv
Content-Type: multipart/form-data
Body: file (CSV file)
Response: { uploadId, transactionCount, recurringPaymentsDetected }
```

### Transactions
```
GET /api/transactions
Query params: ?from=2024-01-01&to=2024-12-31&text=Netflix&page=0&size=50
  - from/to: date range filter
  - text: search in partner_name and details (case-insensitive, partial match)
  - page/size: pagination
Response: { content: [...], totalElements, totalPages }

GET /api/transactions/{id}
Response: { transaction details }
```

### Recurring Payments
```
GET /api/recurring-payments
Response: [{ id, name, categoryId, categoryName, averageAmount, frequency, isIncome, isActive }]

PUT /api/recurring-payments/{id}
Body: { categoryId, name, isActive }
Response: { updated recurring payment }

GET /api/recurring-payments/{id}/transactions
Response: [{ linked transactions }]
```

### Analytics
```
GET /api/analytics/annual-overview?year=2024
Response: {
  totalIncome,
  totalExpenses,
  totalRecurringExpenses,
  monthlyBreakdown: [{ month, income, expenses, surplus }],
  byCategory: [{ category, total, percentage }],
  recurringPayments: [{ name, monthlyAmount, annualAmount, category }]
}

GET /api/analytics/predictions?months=6
Response: {
  predictions: [{ month, expectedIncome, expectedExpenses, expectedSurplus }],
  upcomingPayments: [{ name, date, amount }]
}
```

---

## Project Structure

```
recurring-payments-tracker/
├── package.json              # Root monorepo package.json
├── package-lock.json
├── .gitignore
├── README.md
├── docker-compose.yml
├── backend/
│   ├── pom.xml
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/tracker/
│   │   │   │   ├── RecurringPaymentsApplication.java
│   │   │   │   ├── config/
│   │   │   │   │   └── CorsConfig.java
│   │   │   │   ├── controller/
│   │   │   │   │   ├── TransactionController.java
│   │   │   │   │   ├── RecurringPaymentController.java
│   │   │   │   │   └── AnalyticsController.java
│   │   │   │   ├── service/
│   │   │   │   │   ├── CsvParserService.java
│   │   │   │   │   ├── RecurringDetectionService.java
│   │   │   │   │   ├── TransactionService.java
│   │   │   │   │   └── AnalyticsService.java
│   │   │   │   ├── repository/
│   │   │   │   │   ├── TransactionRepository.java
│   │   │   │   │   ├── RecurringPaymentRepository.java
│   │   │   │   │   └── FileUploadRepository.java
│   │   │   │   ├── model/
│   │   │   │   │   ├── entity/
│   │   │   │   │   │   ├── Transaction.java
│   │   │   │   │   │   ├── RecurringPayment.java
│   │   │   │   │   │   ├── FileUpload.java
│   │   │   │   │   │   └── Category.java
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── UploadResponseDto.java
│   │   │   │   │       ├── AnnualOverviewDto.java
│   │   │   │   │       └── PredictionDto.java
│   │   │   │   └── util/
│   │   │   │       ├── CsvParser.java
│   │   │   │       └── StringSimilarity.java
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       └── db/migration/ (Flyway)
│   │   │           └── V1__initial_schema.sql
│   │   └── test/
│   └── Dockerfile
├── frontend/
│   ├── angular.json
│   ├── package.json          # Workspace package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.ts
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app/
│   │       ├── app.component.ts
│   │       ├── app.config.ts
│   │       ├── app.routes.ts
│   │       ├── core/
│   │       │   └── services/
│   │       │       ├── api.service.ts
│   │       │       ├── transaction.service.ts
│   │       │       ├── recurring-payment.service.ts
│   │       │       └── analytics.service.ts
│   │       ├── models/
│   │       │   ├── transaction.model.ts
│   │       │   ├── recurring-payment.model.ts
│   │       │   └── analytics.model.ts
│   │       └── features/
│   │           ├── file-upload/
│   │           │   └── file-upload.component.ts
│   │           ├── dashboard/
│   │           │   ├── dashboard.component.ts
│   │           │   ├── monthly-breakdown/
│   │           │   │   └── monthly-breakdown.component.ts
│   │           │   ├── category-pie-chart/
│   │           │   │   └── category-pie-chart.component.ts
│   │           │   └── monthly-surplus/
│   │           │       └── monthly-surplus.component.ts
│   │           ├── recurring-payments/
│   │           │   └── recurring-payments-list.component.ts
│   │           └── predictions/
│   │               └── upcoming-payments.component.ts
│   └── Dockerfile
```

---

## Implementation Phases

### Phase 1: Project Setup & Database
1. Initialize Spring Boot project with dependencies (Web, JPA, PostgreSQL, Flyway)
2. Create database schema with Flyway migrations
3. Set up entity classes and repositories
4. Configure Docker Compose for PostgreSQL
5. Initialize Angular project with Angular CLI + Tailwind

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
```java
// Use Jaro-Winkler similarity for partner name matching
// Threshold: 0.85 for high confidence match
public double similarity(String s1, String s2) {
    // Normalize: lowercase, remove special chars, trim
    // Apply Jaro-Winkler algorithm
    // Return score 0.0 - 1.0
}
```

### Interval Detection
```java
// Analyze gaps between transactions for same partner
// If median gap ≈ 30 days → MONTHLY
// If median gap ≈ 90 days → QUARTERLY  
// If median gap ≈ 365 days → YEARLY
public Frequency detectFrequency(List<LocalDate> dates) {
    // Calculate day gaps between consecutive dates
    // Find median gap
    // Map to frequency enum
}
```

### Next Payment Prediction
```java
// Based on detected frequency and last payment date
public LocalDate predictNext(LocalDate lastPayment, Frequency freq) {
    return switch(freq) {
        case MONTHLY -> lastPayment.plusMonths(1);
        case QUARTERLY -> lastPayment.plusMonths(3);
        case YEARLY -> lastPayment.plusYears(1);
    };
}
```

---

## Configuration

### application.yml
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/payments_tracker
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:postgres}
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
  flyway:
    enabled: true
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB

server:
  port: 8080
```

### docker-compose.yml
```yaml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: payments_tracker
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      DB_USERNAME: postgres
      DB_PASSWORD: postgres
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/payments_tracker
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  pgdata:
```

---

## Dependencies

### Backend (pom.xml)
```xml
<properties>
    <java.version>24</java.version>
    <spring-boot.version>3.4.4</spring-boot.version>
</properties>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-core</artifactId>
    </dependency>
    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-database-postgresql</artifactId>
    </dependency>
    <dependency>
        <groupId>org.apache.commons</groupId>
        <artifactId>commons-csv</artifactId>
        <version>1.12.0</version>
    </dependency>
    <dependency>
        <groupId>org.apache.commons</groupId>
        <artifactId>commons-text</artifactId>
        <version>1.12.0</version>
    </dependency>
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

### Frontend (package.json)
```json
{
  "dependencies": {
    "@angular/core": "^19.x",
    "@angular/common": "^19.x",
    "@angular/router": "^19.x",
    "@angular/forms": "^19.x",
    "@angular/platform-browser": "^19.x",
    "ng2-charts": "^6.x",
    "chart.js": "^4.x",
    "rxjs": "^7.x"
  },
  "devDependencies": {
    "@angular/cli": "^19.x",
    "@angular/compiler-cli": "^19.x",
    "tailwindcss": "^3.x",
    "typescript": "~5.6.x"
  }
}
```

---

## Getting Started

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd recurring-payments-tracker
npm install                    # Installs root + workspace dependencies

# 2. Start PostgreSQL
npm run db:start               # or: docker-compose up -d db

# 3. Run backend (in separate terminal)
npm run backend:start          # or: cd backend && ./mvnw spring-boot:run

# 4. Run frontend (in separate terminal)
npm run frontend:start         # or: cd frontend && ng serve

# Or run everything together:
npm run dev                    # Starts db, backend, and frontend concurrently
```

**Available npm scripts:**
| Script | Description |
|--------|-------------|
| `npm run dev` | Start all services (db, backend, frontend) |
| `npm run db:start` | Start PostgreSQL container |
| `npm run backend:start` | Start Spring Boot backend |
| `npm run frontend:start` | Start Angular dev server |
| `npm run frontend:build` | Build Angular for production |

---

## Future Enhancements
- Manual categorization UI
- Export reports as PDF
- Multiple account support
- Budget setting and alerts
- Bank connection via FinTS/PSD2
