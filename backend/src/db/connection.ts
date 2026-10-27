import { createClient, Client, Transaction as LibsqlTransaction } from '@libsql/client';
import { Pool, PoolClient } from 'pg';
import { config } from '../config';

export interface QueryRunner {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; lastInsertRowid?: number | bigint }>;
}

export interface TransactionContext extends QueryRunner {
  // Methods available inside an atomic transaction
}

class DatabaseManager {
  private pgPool: Pool | null = null;
  private libsqlClient: Client | null = null;
  private isPostgres = false;

  constructor() {
    this.isPostgres =
      config.databaseUrl.startsWith('postgres://') ||
      config.databaseUrl.startsWith('postgresql://');
  }

  public async getClient(): Promise<void> {
    if (this.isPostgres) {
      if (!this.pgPool) {
        this.pgPool = new Pool({
          connectionString: config.databaseUrl,
          ssl: config.databaseUrl.includes('supabase.co') || process.env.DB_SSL === 'true'
            ? { rejectUnauthorized: false }
            : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });
      }
    } else {
      if (!this.libsqlClient) {
        this.libsqlClient = createClient({
          url: config.databaseUrl,
        });
      }
    }
  }

  private convertPlaceholdersForPostgres(sql: string): string {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.getClient();

    if (this.isPostgres && this.pgPool) {
      const pgSql = this.convertPlaceholdersForPostgres(sql);
      const res = await this.pgPool.query(pgSql, params);
      return res.rows.map((row: any) => this.normalizeRow(row));
    } else if (this.libsqlClient) {
      const res = await this.libsqlClient.execute({ sql, args: params });
      return res.rows.map((row) => this.normalizeRow(row as any));
    }

    throw new Error('Database client not initialized');
  }

  public async execute(
    sql: string,
    params: any[] = []
  ): Promise<{ rowsAffected: number; lastInsertRowid?: number | bigint }> {
    await this.getClient();

    if (this.isPostgres && this.pgPool) {
      const pgSql = this.convertPlaceholdersForPostgres(sql);
      const res = await this.pgPool.query(pgSql, params);
      return { rowsAffected: res.rowCount ?? 0 };
    } else if (this.libsqlClient) {
      const res = await this.libsqlClient.execute({ sql, args: params });
      return {
        rowsAffected: res.rowsAffected,
        lastInsertRowid: res.lastInsertRowid,
      };
    }

    throw new Error('Database client not initialized');
  }

  public async transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
    await this.getClient();

    if (this.isPostgres && this.pgPool) {
      const client: PoolClient = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        const txContext: TransactionContext = {
          query: async <R = any>(sql: string, params: any[] = []): Promise<R[]> => {
            const pgSql = this.convertPlaceholdersForPostgres(sql);
            const res = await client.query(pgSql, params);
            return res.rows.map((row: any) => this.normalizeRow(row));
          },
          execute: async (sql: string, params: any[] = []) => {
            const pgSql = this.convertPlaceholdersForPostgres(sql);
            const res = await client.query(pgSql, params);
            return { rowsAffected: res.rowCount ?? 0 };
          },
        };
        const result = await callback(txContext);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else if (this.libsqlClient) {
      let attempts = 0;
      const maxAttempts = 5;
      while (attempts < maxAttempts) {
        attempts++;
        try {
          const libsqlTx: LibsqlTransaction = await this.libsqlClient.transaction('write');
          try {
            const txContext: TransactionContext = {
              query: async <R = any>(sql: string, params: any[] = []): Promise<R[]> => {
                const res = await libsqlTx.execute({ sql, args: params });
                return res.rows.map((row) => this.normalizeRow(row as any));
              },
              execute: async (sql: string, params: any[] = []) => {
                const res = await libsqlTx.execute({ sql, args: params });
                return {
                  rowsAffected: res.rowsAffected,
                  lastInsertRowid: res.lastInsertRowid,
                };
              },
            };
            const result = await callback(txContext);
            await libsqlTx.commit();
            return result;
          } catch (error) {
            await libsqlTx.rollback();
            throw error;
          }
        } catch (err: any) {
          const isBusy =
            err?.code === 'SQLITE_BUSY' ||
            err?.rawCode === 5 ||
            (err?.message && err.message.includes('SQLITE_BUSY'));
          if (isBusy && attempts < maxAttempts) {
            // Jittered backoff
            await new Promise((resolve) => setTimeout(resolve, 50 * attempts + Math.random() * 50));
            continue;
          }
          throw err;
        }
      }
    }

    throw new Error('Database client not initialized');
  }

  private normalizeRow(row: any): any {
    if (!row || typeof row !== 'object') return row;
    const normalized: any = {};
    for (const key of Object.keys(row)) {
      let val = row[key];
      // Convert balance and amount to number if they arrive as string/numeric
      if ((key === 'balance' || key === 'amount') && val !== null && val !== undefined) {
        val = parseFloat(val);
      }
      normalized[key] = val;
    }
    return normalized;
  }

  public async initDatabase(): Promise<void> {
    await this.getClient();

    if (!this.isPostgres && this.libsqlClient) {
      try {
        await this.libsqlClient.execute('PRAGMA journal_mode = WAL;');
        await this.libsqlClient.execute('PRAGMA busy_timeout = 5000;');
        await this.libsqlClient.execute('PRAGMA synchronous = NORMAL;');
      } catch {
        // In-memory or remote libsql might ignore pragmas
      }
    }

    // Accounts Table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        CONSTRAINT chk_account_balance_non_negative CHECK (balance >= 0)
      );
    `);

    // Transactions Table
    await this.execute(`
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
    `);

    // Transfers Table (Bonus)
    await this.execute(`
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
    `);

    // Indexes
    try {
      await this.execute(`
        CREATE INDEX IF NOT EXISTS idx_transactions_account_created ON transactions(account_id, created_at DESC);
      `);
      await this.execute(`
        CREATE INDEX IF NOT EXISTS idx_transactions_account_type ON transactions(account_id, type);
      `);
      await this.execute(`
        CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at DESC);
      `);
    } catch {
      // Index might already exist or not supported by some engines
    }
  }

  public async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    if (this.libsqlClient) {
      this.libsqlClient.close();
      this.libsqlClient = null;
    }
  }
}

export const db = new DatabaseManager();
