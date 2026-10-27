import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { accountRepository } from '../repositories/accountRepository';
import { transactionRepository } from '../repositories/transactionRepository';
import { transferRepository } from '../repositories/transferRepository';
import { CreateTransferDTO, Transfer, Transaction } from '../types';
import {
  NotFoundError,
  InsufficientFundsError,
  ConflictError,
  ValidationError,
} from '../middleware/errors';
import { addMoney, subtractMoney } from '../utils/money';

export class TransferService {
  public async executeTransfer(dto: CreateTransferDTO): Promise<{
    transfer: Transfer;
    source_new_balance: number;
    destination_new_balance: number;
  }> {
    if (dto.source_account_id === dto.destination_account_id) {
      throw new ValidationError('Source and destination accounts must be different');
    }

    // Execute transfer atomically inside database transaction
    return await db.transaction(async (tx) => {
      // 1. Check if transfer reference already exists
      const existingTransfer = await transferRepository.findByReference(
        dto.source_account_id,
        dto.reference_id,
        tx
      );
      if (existingTransfer) {
        throw new ConflictError(
          `Transfer with reference_id '${dto.reference_id}' already exists for this source account.`
        );
      }

      // 2. Prevent deadlock by sorting account IDs before acquiring locks
      const [firstId, secondId] = [
        dto.source_account_id,
        dto.destination_account_id,
      ].sort();

      const accountFirst = await accountRepository.findByIdForUpdate(firstId, tx);
      const accountSecond = await accountRepository.findByIdForUpdate(secondId, tx);

      const sourceAccount =
        firstId === dto.source_account_id ? accountFirst : accountSecond;
      const destinationAccount =
        firstId === dto.destination_account_id ? accountFirst : accountSecond;

      if (!sourceAccount) {
        throw new NotFoundError(`Source account '${dto.source_account_id}' not found`);
      }
      if (!destinationAccount) {
        throw new NotFoundError(
          `Destination account '${dto.destination_account_id}' not found`
        );
      }

      // 3. Verify sufficient balance in source account
      if (sourceAccount.balance < dto.amount) {
        throw new InsufficientFundsError(sourceAccount.balance, dto.amount);
      }

      const now = new Date().toISOString();
      const debitTxId = uuidv4();
      const creditTxId = uuidv4();
      const transferId = uuidv4();

      // 4. Create source DEBIT transaction entry
      const debitTx: Transaction = {
        id: debitTxId,
        account_id: sourceAccount.id,
        type: 'debit',
        amount: dto.amount,
        description:
          dto.description ||
          `Transfer to ${destinationAccount.name} (${destinationAccount.id})`,
        reference_id: `TRF-DEBIT-${dto.reference_id}`,
        created_at: now,
      };
      await transactionRepository.create(debitTx, tx);

      // 5. Create destination CREDIT transaction entry
      const creditTx: Transaction = {
        id: creditTxId,
        account_id: destinationAccount.id,
        type: 'credit',
        amount: dto.amount,
        description:
          dto.description ||
          `Transfer from ${sourceAccount.name} (${sourceAccount.id})`,
        reference_id: `TRF-CREDIT-${dto.reference_id}`,
        created_at: now,
      };
      await transactionRepository.create(creditTx, tx);

      // 6. Calculate new balances
      const sourceNewBalance = subtractMoney(sourceAccount.balance, dto.amount);
      const destinationNewBalance = addMoney(destinationAccount.balance, dto.amount);

      // 7. Update balances
      await accountRepository.updateBalance(sourceAccount.id, sourceNewBalance, tx);
      await accountRepository.updateBalance(
        destinationAccount.id,
        destinationNewBalance,
        tx
      );

      // 8. Record audit log in transfers table
      const transferRecord: Transfer = {
        id: transferId,
        source_account_id: sourceAccount.id,
        destination_account_id: destinationAccount.id,
        amount: dto.amount,
        reference_id: dto.reference_id,
        description: dto.description || null,
        debit_transaction_id: debitTxId,
        credit_transaction_id: creditTxId,
        created_at: now,
      };
      await transferRepository.create(transferRecord, tx);

      return {
        transfer: transferRecord,
        source_new_balance: sourceNewBalance,
        destination_new_balance: destinationNewBalance,
      };
    });
  }
}

export const transferService = new TransferService();
