# Confluencer — Transaction Ledger System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase%20Ready-336791.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-20%2F20%20Passing-brightgreen.svg)](backend/tests)

A production-grade, ACID-compliant **Transaction Ledger API & Dashboard** developed for the **Full Stack Developer Assessment** (Walnut Folks / Confluencr / Kalakaar / Intent Farm).

The system provides account creation, credit/debit transactions, live balance calculations, paginated transaction histories, and an atomic money transfer service (Bonus) with full database constraints and race-condition safety.

---

## 🌟 Key Features & Assessment Requirements

| Requirement | Implementation Detail | Status |
|:---|:---|:---:|
| **1. Create Account** | Unique UUID, required name, system-generated `created_at`. Enforces that initial balance is strictly `0.00` and client cannot provide an initial balance. | ✅ Complete |
| **2. Add Transaction** | Supports `credit` (increases balance) and `debit` (decreases balance). Prevents negative balances (`CHECK (balance >= 0)`). Rejects debit if insufficient funds (`422`). | ✅ Complete |
| **3. Duplicate Detection** | Scoped idempotency: for the same account, `reference_id` must be unique (`UNIQUE(account_id, reference_id)`). Re-submission returns `409 Conflict`, leaving balance unchanged. The same reference ID is permitted across different accounts. | ✅ Complete |
| **4. Account Balance** | Real-time balance retrieval via `GET /accounts/:id/balance`. Returns `404` for non-existent accounts. | ✅ Complete |
| **5. Transaction History** | Paginated (`page`, `limit`), filtered by type (`credit`, `debit`, or both), and ordered **latest-first** (`created_at DESC`). | ✅ Complete |
| **6. Data Integrity** | **Transaction Immutability**: Historical entries cannot be updated (`PUT`/`PATCH`) or deleted (`DELETE`) via API (`405`). **Balance Consistency**: Mathematically audited via `GET /accounts/:id/verify-integrity`. | ✅ Complete |
| **7. Atomicity** | Every ledger mutation and balance update executes within a single database transaction with row-level locking (`SELECT ... FOR UPDATE` in Postgres / `BEGIN IMMEDIATE` in SQLite). | ✅ Complete |
| **8. Validations & Errors** | Zod validation schemas, consistent JSON error responses with meaningful HTTP status codes (400, 404, 405, 409, 422, 500). | ✅ Complete |
| **9. Bonus: Money Transfer** | Multi-account atomic transfer: debits Account A and credits Account B within a single database transaction. Deterministic lock ordering prevents deadlocks. Partial transfers impossible. | ✅ Complete |
| **10. Full Stack Experience** | Interactive, glassmorphic React dashboard with real-time balance card, live ledger explorer, edge-case testing triggers, and built-in API reference modal. | ✅ Complete |

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Node.js, Express, TypeScript, Zod, UUID
- **Database**:
  - **PostgreSQL / Supabase**: Supported out of the box via `DATABASE_URL` with SSL connection pooling and row-level locking (`FOR UPDATE`).
  - **Embedded SQLite**: Zero-configuration default with Write-Ahead Logging (WAL) and backoff retry for instant local evaluation without needing Docker or PostgreSQL installed.
- **Frontend**: React 18, Vite, TypeScript, Vanilla CSS (dark theme, glassmorphism, responsive)
- **Testing**: Vitest, Supertest (20 automated integration & concurrency tests)

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Node.js (version 18 or newer recommended, verified on v22)
- npm

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd Confluencer

# Install root, backend, and frontend packages
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 2. Run Both Backend & Frontend
To run both the backend API (`http://localhost:5000`) and the interactive frontend (`http://localhost:3000`) concurrently:
```bash
npm run dev
```

Alternatively, run them in separate terminals:
```bash
# Terminal 1: Backend API (port 5000)
npm run dev:backend

# Terminal 2: Frontend Dashboard (port 3000)
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000) in your browser to explore the dashboard.

---

## 🧪 Running Automated Tests

A comprehensive suite of **20 automated integration and concurrency tests** validates all assessment rules, business logic, and race-condition safety:

```bash
npm test
```

### Test Suite Highlights:
- **`tests/ledger.test.ts`**:
  - Initial balance enforcement (client cannot provide balance).
  - Credit increases balance; Debit decreases balance.
  - Insufficient funds debit rejection (`422`) with unchanged balance.
  - Duplicate `reference_id` rejection (`409`) within the same account.
  - Same `reference_id` allowed across different accounts.
  - Transaction history filtering, pagination, and latest-first sorting.
  - Immutability guards rejecting `PUT` and `DELETE` requests (`405`).
  - Balance consistency verification against the sum of all transaction logs.
  - Bonus: Atomic money transfer between Account A and Account B.
- **`tests/concurrency.test.ts`**:
  - Simultaneous race-condition test: fires 5 concurrent debit requests against an account with insufficient balance to cover all 5, proving that the atomic transaction row-lock serializes requests without balance corruption.

---

## 🔗 Connecting to Supabase (PostgreSQL Cloud)

To connect this application to your Supabase PostgreSQL instance:
1. Copy your Supabase connection URI from **Project Settings** > **Database**:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
2. Set the `DATABASE_URL` in `backend/.env`:
   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
3. Restart the backend: `npm run dev:backend`.
4. The system will automatically initialize all tables, foreign keys, and indexes on your Supabase Postgres database!

---

## 📑 API Endpoints Summary

| Method | Endpoint | Description | Status Code |
|:---|:---|:---|:---:|
| `POST` | `/api/v1/accounts` | Create new account (initial balance always 0.00) | `201` |
| `GET` | `/api/v1/accounts` | List all accounts (paginated) | `200` |
| `GET` | `/api/v1/accounts/:id` | Get account details | `200` / `404` |
| `GET` | `/api/v1/accounts/:id/balance` | Get real-time account balance | `200` / `404` |
| `GET` | `/api/v1/accounts/:id/verify-integrity` | Audit balance against ledger sum | `200` |
| `POST` | `/api/v1/accounts/:id/transactions` | Add credit or debit transaction | `201` / `409` / `422` |
| `GET` | `/api/v1/accounts/:id/transactions` | Get transactions (paginated, latest-first) | `200` |
| `POST` | `/api/v1/transfers` | Atomic money transfer between two accounts | `201` / `422` |
| `PUT/DEL`| `/api/v1/transactions/:id` | Rejected: Immutability enforcement | `405` |
| `POST` | `/api/v1/seed` | Seed realistic demo dataset | `200` |
| `GET` | `/api/v1/health` | Health check probe | `200` |

Detailed request/response schemas, validation rules, and curl examples are documented in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

---

## 📁 Repository Structure

```
Confluencer/
├── backend/
│   ├── src/
│   │   ├── config/             # Environment & database configuration
│   │   ├── controllers/        # Express HTTP controllers
│   │   ├── services/           # Business logic & transaction orchestration
│   │   ├── repositories/       # Database queries & row-locking access
│   │   ├── db/                 # Dual DB connection manager (Postgres/SQLite) & schema
│   │   ├── middleware/         # Centralized error handling & custom AppErrors
│   │   ├── validators/         # Zod schemas for input validation
│   │   ├── routes/             # RESTful route definitions
│   │   ├── utils/              # Decimal/cents precision arithmetic
│   │   ├── types/              # TypeScript interfaces & DTOs
│   │   ├── app.ts              # Express application factory
│   │   └── server.ts           # Server bootstrap and graceful shutdown
│   ├── tests/
│   │   ├── ledger.test.ts      # 19 integration tests covering all requirements
│   │   └── concurrency.test.ts # Race condition & row-lock concurrency test
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/         # Modals, forms, tables, and API docs viewer
│   │   ├── services/           # Typed API client
│   │   ├── App.tsx             # Main interactive ledger dashboard
│   │   ├── index.css           # Modern design system & glassmorphism styles
│   │   └── main.tsx            # Vite entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── docs/
│   ├── API_DOCUMENTATION.md    # Complete endpoint specs, schemas & cURL commands
│   ├── ASSUMPTIONS.md          # Business, technical & data integrity assumptions
│   └── DEPLOYMENT_GUIDE_AWS_RENDER_NETLIFY.md # Deployment to AWS, Supabase, Render, Netlify
├── package.json                # Root scripts to run both dev servers concurrently
└── README.md                   # Project overview & documentation
```

---

## 📄 Documentation Links
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Architectural & Business Assumptions](docs/ASSUMPTIONS.md)
- [Deployment Guide (AWS / Render / Netlify / Supabase)](docs/DEPLOYMENT_GUIDE_AWS_RENDER_NETLIFY.md)
