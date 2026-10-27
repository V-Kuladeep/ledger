import { v4 as uuidv4 } from 'uuid';
import { accountRepository } from '../repositories/accountRepository';
import { transactionRepository } from '../repositories/transactionRepository';
import { Account, CreateAccountDTO, PaginatedResult } from '../types';
import { NotFoundError } from '../middleware/errors';

export class AccountService {
  public async createAccount(dto: CreateAccountDTO): Promise<Account> {
    const now = new Date().toISOString();
    const account: Account = {
      id: uuidv4(),
      name: dto.name.trim(),
      balance: 0.00, // Strictly enforced: initial balance is always 0
      created_at: now,
      updated_at: now,
    };

    return await accountRepository.create(account);
  }

  public async getAccountById(id: string): Promise<Account> {
    const account = await accountRepository.findById(id);
    if (!account) {
      throw new NotFoundError(`Account with ID '${id}' not found`);
    }
    return account;
  }

  public async getAccountBalance(id: string): Promise<{ account_id: string; balance: number; name: string }> {
    const account = await this.getAccountById(id);
    return {
      account_id: account.id,
      balance: account.balance,
      name: account.name,
    };
  }

  public async listAccounts(page: number = 1, limit: number = 50): Promise<PaginatedResult<Account>> {
    const offset = (page - 1) * limit;
    const { accounts, total } = await accountRepository.findAll(limit, offset);

    return {
      items: accounts,
      pagination: {
        current_page: page,
        page_size: limit,
        total_records: total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Verifies that the stored account balance strictly matches the calculated
   * sum of all immutable transactions in the ledger.
   */
  public async verifyBalanceIntegrity(id: string): Promise<{
    account_id: string;
    stored_balance: number;
    calculated_balance: number;
    consistent: boolean;
  }> {
    const account = await this.getAccountById(id);
    const calculated = await transactionRepository.calculateBalanceFromHistory(id);

    return {
      account_id: account.id,
      stored_balance: account.balance,
      calculated_balance: calculated,
      consistent: account.balance === calculated,
    };
  }
}

export const accountService = new AccountService();
