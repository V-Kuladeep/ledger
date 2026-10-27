import { db, QueryRunner, TransactionContext } from '../db/connection';
import { Account } from '../types';

export class AccountRepository {
  public async create(account: Account, runner: QueryRunner = db): Promise<Account> {
    const sql = `
      INSERT INTO accounts (id, name, balance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    await runner.execute(sql, [
      account.id,
      account.name,
      account.balance,
      account.created_at,
      account.updated_at,
    ]);
    return account;
  }

  public async findById(id: string, runner: QueryRunner = db): Promise<Account | null> {
    const sql = `SELECT * FROM accounts WHERE id = ?`;
    const rows = await runner.query<Account>(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Fetch account with row-level lock within an atomic transaction
   */
  public async findByIdForUpdate(id: string, tx: TransactionContext): Promise<Account | null> {
    // In PostgreSQL, FOR UPDATE locks the row against concurrent modifications.
    // In SQLite, the write transaction (BEGIN IMMEDIATE) already has an exclusive database-level lock.
    const isPostgres = (db as any).isPostgres;
    const sql = isPostgres
      ? `SELECT * FROM accounts WHERE id = ? FOR UPDATE`
      : `SELECT * FROM accounts WHERE id = ?`;

    const rows = await tx.query<Account>(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  public async updateBalance(id: string, newBalance: number, tx: TransactionContext): Promise<void> {
    const sql = `
      UPDATE accounts 
      SET balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await tx.execute(sql, [newBalance, id]);
  }

  public async findAll(limit: number = 50, offset: number = 0): Promise<{ accounts: Account[]; total: number }> {
    const dataSql = `SELECT * FROM accounts ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) as count FROM accounts`;

    const [rows, countRows] = await Promise.all([
      db.query<Account>(dataSql, [limit, offset]),
      db.query<{ count: number | string }>(countSql),
    ]);

    const total = parseInt(String(countRows[0]?.count || 0), 10);
    return { accounts: rows, total };
  }
}

export const accountRepository = new AccountRepository();
