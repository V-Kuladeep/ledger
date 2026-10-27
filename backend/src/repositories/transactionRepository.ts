import { db, QueryRunner } from '../db/connection';
import { Transaction, TransactionType } from '../types';
import { roundMoney } from '../utils/money';

export class TransactionRepository {
  public async create(transaction: Transaction, runner: QueryRunner = db): Promise<Transaction> {
    const sql = `
      INSERT INTO transactions (id, account_id, type, amount, description, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await runner.execute(sql, [
      transaction.id,
      transaction.account_id,
      transaction.type,
      transaction.amount,
      transaction.description || null,
      transaction.reference_id,
      transaction.created_at,
    ]);
    return transaction;
  }

  public async findByReference(
    accountId: string,
    referenceId: string,
    runner: QueryRunner = db
  ): Promise<Transaction | null> {
    const sql = `SELECT * FROM transactions WHERE account_id = ? AND reference_id = ? LIMIT 1`;
    const rows = await runner.query<Transaction>(sql, [accountId, referenceId]);
    return rows.length > 0 ? rows[0] : null;
  }

  public async findById(id: string, runner: QueryRunner = db): Promise<Transaction | null> {
    const sql = `SELECT * FROM transactions WHERE id = ?`;
    const rows = await runner.query<Transaction>(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  public async findByAccountId(
    accountId: string,
    options: { type?: TransactionType; limit: number; offset: number }
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const params: any[] = [accountId];
    let whereClause = `WHERE account_id = ?`;

    if (options.type) {
      whereClause += ` AND type = ?`;
      params.push(options.type);
    }

    const countSql = `SELECT COUNT(*) as count FROM transactions ${whereClause}`;
    const dataSql = `
      SELECT * FROM transactions 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, options.limit, options.offset];

    const [rows, countRows] = await Promise.all([
      db.query<Transaction>(dataSql, dataParams),
      db.query<{ count: number | string }>(countSql, params),
    ]);

    const total = parseInt(String(countRows[0]?.count || 0), 10);
    return { transactions: rows, total };
  }

  /**
   * Re-calculates balance strictly from immutable transaction ledger rows.
   * Proves Balance Consistency (Requirement 5).
   */
  public async calculateBalanceFromHistory(
    accountId: string,
    runner: QueryRunner = db
  ): Promise<number> {
    const sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debits
      FROM transactions
      WHERE account_id = ?
    `;
    const rows = await runner.query<{ total_credits: number; total_debits: number }>(sql, [accountId]);
    if (!rows.length) return 0;
    const credits = parseFloat(String(rows[0].total_credits || 0));
    const debits = parseFloat(String(rows[0].total_debits || 0));
    return roundMoney(credits - debits);
  }
}

export const transactionRepository = new TransactionRepository();
