-- Database Schema for Transaction Ledger API
-- Supports both PostgreSQL / Supabase and SQLite

-- 1. Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT chk_account_balance_non_negative CHECK (balance >= 0)
);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    description TEXT,
    reference_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT fk_transaction_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CONSTRAINT chk_transaction_type CHECK (type IN ('credit', 'debit')),
    CONSTRAINT chk_transaction_amount_positive CHECK (amount > 0),
    CONSTRAINT uq_account_reference UNIQUE (account_id, reference_id)
);

-- 3. Transfers Table (Bonus)
CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY,
    source_account_id TEXT NOT NULL,
    destination_account_id TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    reference_id TEXT NOT NULL,
    description TEXT,
    debit_transaction_id TEXT,
    credit_transaction_id TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT fk_transfer_source FOREIGN KEY (source_account_id) REFERENCES accounts(id),
    CONSTRAINT fk_transfer_destination FOREIGN KEY (destination_account_id) REFERENCES accounts(id),
    CONSTRAINT chk_transfer_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_different_accounts CHECK (source_account_id <> destination_account_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_account_created ON transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_type ON transactions(account_id, type);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at DESC);
