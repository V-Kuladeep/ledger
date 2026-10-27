# Architectural & Business Assumptions — Transaction Ledger System

This document outlines the architectural, data integrity, and business domain assumptions made during the design and implementation of the **Transaction Ledger System**.

---

## 1. Initial Balance Policy & Client Restrictions
- **Requirement**: "Initial balance must always be 0. The client should not be allowed to set the initial balance."
- **Assumption & Enforcement**:
  - The `POST /api/v1/accounts` endpoint strictly validates that no `balance` field is passed by the client. If a client attempts to pass a `balance` field (even `0`), the Zod validator rejects the request with `400 VALIDATION_ERROR`.
  - The business service layer hardcodes `account.balance = 0.00` on every new account creation.
  - Initial funding can only be added through a validated `credit` transaction, ensuring that every cent in the system has an immutable audit trail.

---

## 2. Reference ID Uniqueness & Idempotency
- **Requirement**: "For the same account, reference_id must be unique... The same reference_id may be used for different accounts."
- **Assumption & Enforcement**:
  - Uniqueness is enforced at both the **database level** and the **application service layer**.
  - **Database Constraint**: `CONSTRAINT uq_account_reference UNIQUE (account_id, reference_id)`.
  - Re-submitting an identical `reference_id` for the same account is treated as an idempotency conflict and returns `409 DUPLICATE_TRANSACTION`.
  - Re-submitting the same `reference_id` for a **different account** is permitted by design (e.g. two separate customers paying against the same external invoice or batch number `INV-2026-001`).

---

## 3. Financial Precision & Floating-Point Representation
- **Problem**: In IEEE 754 floating-point arithmetic (standard JavaScript `Number`), operations like `0.1 + 0.2` yield `0.30000000000000004`, leading to balance corruption over time.
- **Assumption & Enforcement**:
  - All financial amounts are stored as exact decimal/numeric types (`NUMERIC(15, 2)`).
  - All balance arithmetic in Node.js passes through a strict precision utility (`toCents`, `fromCents`, `addMoney`, `subtractMoney`) that converts numbers to basis cents (`Math.round(amount * 100)`), performs integer calculations, and maps back to 2 decimal places.
  - Amounts with more than 2 decimal places (e.g. `10.555`) are rejected by request validation.

---

## 4. Transaction Immutability (Ledger Integrity)
- **Requirement**: "Once a transaction is created, it must not be editable or deletable through the API."
- **Assumption & Enforcement**:
  - Accounting ledgers must remain tamper-proof. The API explicitly disables `PUT`, `PATCH`, and `DELETE` on transactions (`/api/v1/transactions/:id`), returning `405 Method Not Allowed`.
  - If a mistake occurs in real-world accounting, a compensatory reversing transaction (debit or credit) must be issued rather than mutating history.
  - Foreign key constraints use `ON DELETE RESTRICT` to ensure accounts with transaction history cannot be deleted out from under active records.

---

## 5. Atomicity & Race-Condition Isolation
- **Requirement**: "Creating a transaction and updating the account balance must be treated as one atomic operation. If either operation fails, neither change should be persisted."
- **Assumption & Enforcement**:
  - Every ledger mutation runs within a strict database transaction (`BEGIN ... COMMIT / ROLLBACK`).
  - **Row-Level Locking**: In PostgreSQL/Supabase, accounts are fetched using `SELECT ... FOR UPDATE` within the transaction. In SQLite, transactions use `BEGIN IMMEDIATE` with Write-Ahead Logging (WAL) and backoff retry.
  - This ensures that if 10 concurrent debit requests arrive simultaneously for an account with only $100 balance, the requests are serialized at the database lock level. Exactly as many debits as the balance allows will succeed, and all subsequent debits will fail with `422 INSUFFICIENT_BALANCE` without negative balances.

---

## 6. Deadlock Prevention in Multi-Account Transfers (Bonus)
- **Problem**: If Account A attempts to transfer to Account B at the exact same millisecond that Account B attempts to transfer to Account A, acquiring locks out of order can trigger a database deadlock:
  - Worker 1 locks A, waits for B.
  - Worker 2 locks B, waits for A.
- **Assumption & Enforcement**:
  - The `TransferService` implements **deterministic lock acquisition**: Account IDs are sorted lexicographically (`[sourceId, destId].sort()`) before acquiring locks.
  - Both workers will always acquire the lower UUID lock first, completely eliminating the possibility of cyclic deadlocks.
  - The transfer creates linked double-entry transaction rows (`TRF-DEBIT-...` on source, `TRF-CREDIT-...` on destination) and an audit row in `transfers`.

---

## 7. Dual Database Engine Support
- **Interview & Testing Context**:
  - To enable zero-setup evaluation locally (without requiring local Docker or PostgreSQL installations), the system provides an embedded SQLite engine with WAL mode as the default.
  - For cloud deployment (Supabase or AWS RDS), setting `DATABASE_URL=postgresql://...` instantly switches the connection pool to native PostgreSQL with SSL and connection pooling.
  - Parameter placeholders are normalized dynamically (`?` to `$1, $2, ...` in Postgres) so the exact same repository queries work seamlessly across both environments.

---

## 8. Pagination & Sorting
- **Parameters**: 1-indexed `page` (default 1) and `limit` (default 10, max 100).
- **Sorting**: Ledger history is strictly returned in `created_at DESC` (latest-first order) to match financial statement conventions.
