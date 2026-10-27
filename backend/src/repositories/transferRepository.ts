import { db, QueryRunner } from '../db/connection';
import { Transfer } from '../types';

export class TransferRepository {
  public async create(transfer: Transfer, runner: QueryRunner = db): Promise<Transfer> {
    const sql = `
      INSERT INTO transfers (
        id, source_account_id, destination_account_id, amount, 
        reference_id, description, debit_transaction_id, credit_transaction_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await runner.execute(sql, [
      transfer.id,
      transfer.source_account_id,
      transfer.destination_account_id,
      transfer.amount,
      transfer.reference_id,
      transfer.description || null,
      transfer.debit_transaction_id,
      transfer.credit_transaction_id,
      transfer.created_at,
    ]);
    return transfer;
  }

  public async findByReference(
    sourceAccountId: string,
    referenceId: string,
    runner: QueryRunner = db
  ): Promise<Transfer | null> {
    const sql = `SELECT * FROM transfers WHERE source_account_id = ? AND reference_id = ? LIMIT 1`;
    const rows = await runner.query<Transfer>(sql, [sourceAccountId, referenceId]);
    return rows.length > 0 ? rows[0] : null;
  }
}

export const transferRepository = new TransferRepository();
