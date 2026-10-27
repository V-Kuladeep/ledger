import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { accountRepository } from '../repositories/accountRepository';
import { transactionRepository } from '../repositories/transactionRepository';
import {
  CreateTransactionDTO,
  Transaction,
  TransactionHistoryQuery,
  PaginatedResult,
} from '../types';
import {
  NotFoundError,
  ConflictError,
  InsufficientFundsError,
  ValidationError,
} from '../middleware/errors';
import { addMoney, subtractMoney } from '../utils/money';

export class TransactionService {
  public async addTransaction(
    dto: CreateTransactionDTO
  ): Promise<{ transaction: Transaction; new_balance: number }> {
    const accountId = dto.account_id;
    if (!accountId) {
      throw new ValidationError('Account ID is required');
    }

    // Execute atomically inside a database transaction
    return await db.transaction(async (tx) => {
      // 1. Lock and verify account existence
      const account = await accountRepository.findByIdForUpdate(accountId, tx);
      if (!account) {
        throw new NotFoundError(`Account with ID '${accountId}' does not exist`);
      }

      // 2. Check for duplicate reference_id within the same account
      const existingTx = await transactionRepository.findByReference(
        accountId,
        dto.reference_id,
        tx
      );
      if (existingTx) {
        throw new ConflictError(
          `Transaction with reference_id '${dto.reference_id}' already exists for this account.`
        );
      }

      // 3. Balance verification and calculation
      let newBalance = account.balance;
      if (dto.type === 'credit') {
        newBalance = addMoney(account.balance, dto.amount);
      } else if (dto.type === 'debit') {
        if (account.balance < dto.amount) {
          throw new InsufficientFundsError(account.balance, dto.amount);
        }
        newBalance = subtractMoney(account.balance, dto.amount);
      } else {
        throw new ValidationError("Invalid transaction type. Must be 'credit' or 'debit'.");
      }

      // 4. Create transaction ledger entry
      const now = new Date().toISOString();
      const transaction: Transaction = {
        id: uuidv4(),
        account_id: accountId,
        type: dto.type,
        amount: dto.amount,
        description: dto.description?.trim() || null,
        reference_id: dto.reference_id.trim(),
        created_at: now,
      };

      await transactionRepository.create(transaction, tx);

      // 5. Update account balance atomically
      await accountRepository.updateBalance(accountId, newBalance, tx);

      return {
        transaction,
        new_balance: newBalance,
      };
    });
  }

  public async getTransactionHistory(
    accountId: string,
    query: TransactionHistoryQuery
  ): Promise<PaginatedResult<Transaction>> {
    // 1. Verify account exists
    const account = await accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundError(`Account with ID '${accountId}' does not exist`);
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    // 2. Fetch paginated transactions sorted latest-first
    const { transactions, total } = await transactionRepository.findByAccountId(
      accountId,
      {
        type: query.type,
        limit,
        offset,
      }
    );

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      items: transactions,
      pagination: {
        current_page: page,
        page_size: limit,
        total_records: total,
        total_pages: totalPages,
      },
    };
  }
}

export const transactionService = new TransactionService();
