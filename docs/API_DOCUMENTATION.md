# API Documentation — Transaction Ledger API

The Transaction Ledger API is a production-grade, ACID-compliant RESTful service built with Node.js, Express, TypeScript, and dual-driver support for PostgreSQL (Supabase / AWS RDS) and SQLite.

## Base URL
- **Local Development**: `http://localhost:5000/api/v1`
- **Frontend Dashboard**: `http://localhost:3000`

---

## Standard Error Response Format
All errors follow a unified JSON schema with appropriate HTTP status codes:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error description",
    "details": {}
  }
}
```

| HTTP Code | Error Code | Description |
|:---|:---|:---|
| `400 Bad Request` | `VALIDATION_ERROR` | Missing required fields, invalid format, amount <= 0, or client provided initial balance |
| `404 Not Found` | `NOT_FOUND` | Account ID or transaction does not exist |
| `405 Method Not Allowed` | `TRANSACTION_IMMUTABLE` | Attempted update (`PUT`/`PATCH`) or deletion (`DELETE`) on immutable transaction |
| `409 Conflict` | `DUPLICATE_TRANSACTION` | A transaction with this `reference_id` already exists for this account |
| `422 Unprocessable` | `INSUFFICIENT_BALANCE` | Debit transaction or transfer rejected due to insufficient account balance |
| `500 Server Error` | `INTERNAL_SERVER_ERROR` | Unexpected internal database or server failure |

---

## 1. Accounts

### 1.1 Create Account
Creates a new account. By ledger specification, the initial balance is **always 0.00**. The client is **not allowed** to supply an initial balance.

- **Endpoint**: `POST /accounts`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "name": "Alice Walker"
}
```
- **Validation Rules**:
  - `name`: String, required, 1-100 characters.
  - `balance`: Must NOT be provided. If supplied by client, rejected with `400 VALIDATION_ERROR`.
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "e9b2510f-b258-40da-9db1-13cf258d4a9a",
    "name": "Alice Walker",
    "balance": 0.00,
    "created_at": "2026-10-27T16:45:00.000Z",
    "updated_at": "2026-10-27T16:45:00.000Z"
  }
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Walker"}'
```

---

### 1.2 Get Account Balance
Retrieves the real-time balance and metadata for a specific account.

- **Endpoint**: `GET /accounts/:id/balance`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "account_id": "e9b2510f-b258-40da-9db1-13cf258d4a9a",
    "balance": 150.00,
    "name": "Alice Walker"
  }
}
```
- **Response (404 Not Found)**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Account with ID '...' not found"
  }
}
```

**cURL Example**:
```bash
curl http://localhost:5000/api/v1/accounts/e9b2510f-b258-40da-9db1-13cf258d4a9a/balance
```

---

### 1.3 List All Accounts
Lists all ledger accounts with pagination.

- **Endpoint**: `GET /accounts?page=1&limit=20`
- **Query Parameters**:
  - `page` (optional, default: 1): Positive integer.
  - `limit` (optional, default: 20): Integer between 1 and 100.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "e9b2510f-b258-40da-9db1-13cf258d4a9a",
        "name": "Alice Walker",
        "balance": 150.00,
        "created_at": "2026-10-27T16:45:00.000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "page_size": 20,
      "total_records": 1,
      "total_pages": 1
    }
  }
}
```

---

### 1.4 Verify Account Balance Consistency (Audit)
Audits the account balance against the mathematical sum of all immutable credit and debit entries in the ledger: `balance == sum(credits) - sum(debits)`.

- **Endpoint**: `GET /accounts/:id/verify-integrity`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "account_id": "e9b2510f-b258-40da-9db1-13cf258d4a9a",
    "stored_balance": 150.00,
    "calculated_balance": 150.00,
    "consistent": true
  }
}
```

---

## 2. Transactions

### 2.1 Add Transaction
Adds a transaction to an account atomically inside a database transaction.

- **Endpoint**: `POST /accounts/:id/transactions` (or `POST /transactions` with `account_id` in body)
- **Request Body**:
```json
{
  "type": "credit",
  "amount": 100.00,
  "reference_id": "DEP-001",
  "description": "Initial account deposit"
}
```
- **Validation Rules**:
  - `type`: Must be `"credit"` or `"debit"`.
  - `amount`: Positive number (`> 0`), max 2 decimal places.
  - `reference_id`: Required string (1-100 characters). Must be unique within the account.
  - `description`: Optional string (max 255 characters).

#### Transaction Business Rules:
1. **Credit**: Increases the account balance by `amount`.
2. **Debit**: Decreases the account balance by `amount`. If `balance < amount`, returns `422 INSUFFICIENT_BALANCE` and leaves balance untouched.
3. **Duplicate Check**: If a transaction with the same `reference_id` is submitted again for the **same account**, returns `409 DUPLICATE_TRANSACTION`. Balance is NOT changed, and no new transaction is inserted.
4. **Different Accounts**: The **same** `reference_id` may be legally used for a **different** account.

- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "76d5e21c-4f81-49b7-b088-34eb1f81d80e",
      "account_id": "e9b2510f-b258-40da-9db1-13cf258d4a9a",
      "type": "credit",
      "amount": 100.00,
      "description": "Initial account deposit",
      "reference_id": "DEP-001",
      "created_at": "2026-10-27T16:50:00.000Z"
    },
    "new_balance": 100.00
  }
}
```

**cURL Examples**:
```bash
# Credit
curl -X POST http://localhost:5000/api/v1/accounts/e9b2510f-b258-40da-9db1-13cf258d4a9a/transactions \
  -H "Content-Type: application/json" \
  -d '{"type": "credit", "amount": 100.00, "reference_id": "DEP-001", "description": "Payroll"}'

# Debit
curl -X POST http://localhost:5000/api/v1/accounts/e9b2510f-b258-40da-9db1-13cf258d4a9a/transactions \
  -H "Content-Type: application/json" \
  -d '{"type": "debit", "amount": 30.00, "reference_id": "PURCHASE-001", "description": "Coffee"}'
```

---

### 2.2 Get Transaction History
Fetches transactions for an account with sorting and pagination.

- **Endpoint**: `GET /accounts/:id/transactions`
- **Query Parameters**:
  - `type` (optional): Filter by `"credit"` or `"debit"`. If omitted, returns both.
  - `page` (optional, default: 1): Page number.
  - `limit` (optional, default: 10): Items per page.
- **Sorting**: Strictly ordered in **latest-first** order based on `created_at DESC`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "account_id": "...",
        "type": "debit",
        "amount": 30.00,
        "description": "Coffee",
        "reference_id": "PURCHASE-001",
        "created_at": "2026-10-27T16:55:00.000Z"
      },
      {
        "id": "...",
        "account_id": "...",
        "type": "credit",
        "amount": 100.00,
        "description": "Payroll",
        "reference_id": "DEP-001",
        "created_at": "2026-10-27T16:50:00.000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "page_size": 10,
      "total_records": 2,
      "total_pages": 1
    }
  }
}
```

**cURL Example**:
```bash
curl "http://localhost:5000/api/v1/accounts/e9b2510f-b258-40da-9db1-13cf258d4a9a/transactions?page=1&limit=10&type=credit"
```

---

### 2.3 Transaction Immutability Guard
In accordance with accounting standards, transactions cannot be edited or deleted through the API.

- **Endpoints**:
  - `PUT /transactions/:id`
  - `PATCH /transactions/:id`
  - `DELETE /transactions/:id`
- **Response (405 Method Not Allowed)**:
```json
{
  "success": false,
  "error": {
    "code": "TRANSACTION_IMMUTABLE",
    "message": "Transaction Immutability Violation: Transactions cannot be modified or deleted once persisted."
  }
}
```

---

## 3. Bonus: Money Transfer API

Transfers money from Account A to Account B atomically.
- Acquires locks deterministically to prevent deadlocks.
- Creates a `debit` transaction on the source account and a `credit` transaction on the destination account.
- If either account fails (e.g. insufficient funds in source, or account not found), the entire transfer is rolled back. Partial transfers are impossible.

- **Endpoint**: `POST /transfers`
- **Request Body**:
```json
{
  "source_account_id": "acc-a-uuid",
  "destination_account_id": "acc-b-uuid",
  "amount": 30.00,
  "reference_id": "TRF-LUNCH-01",
  "description": "Settling lunch bill"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "transfer": {
      "id": "transfer-uuid",
      "source_account_id": "acc-a-uuid",
      "destination_account_id": "acc-b-uuid",
      "amount": 30.00,
      "reference_id": "TRF-LUNCH-01",
      "description": "Settling lunch bill",
      "debit_transaction_id": "...",
      "credit_transaction_id": "...",
      "created_at": "..."
    },
    "source_new_balance": 70.00,
    "destination_new_balance": 80.00
  }
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "source_account_id": "acc-a-uuid",
    "destination_account_id": "acc-b-uuid",
    "amount": 30.00,
    "reference_id": "TRF-LUNCH-01",
    "description": "Settling lunch bill"
  }'
```

---

## 4. Utility Endpoints

### 4.1 Seed Demo Dataset
Quickly generates sample accounts (Alice Walker, Bob Martinez, Charlie Kim) with deposits, withdrawals, and an atomic money transfer for evaluation.

- **Endpoint**: `POST /seed`
- **Response (200 OK)**

### 4.2 Health Check
- **Endpoint**: `GET /health`
- **Response (200 OK)**:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-27T16:50:00.000Z",
  "service": "transaction-ledger-api"
}
```
