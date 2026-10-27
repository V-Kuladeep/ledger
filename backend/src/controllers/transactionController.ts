import { Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transactionService';
import {
  createTransactionSchema,
  transactionHistoryQuerySchema,
} from '../validators/schemas';
import { ImmutableResourceError } from '../middleware/errors';

export class TransactionController {
  public async addTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accountId = req.params.id || req.body.account_id;
      const validated = createTransactionSchema.parse({
        ...req.body,
        account_id: accountId,
      });

      const result = await transactionService.addTransaction(validated as any);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getTransactionHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const validatedQuery = transactionHistoryQuerySchema.parse(req.query);

      const history = await transactionService.getTransactionHistory(
        id,
        validatedQuery as any
      );

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Enforces Transaction Immutability (Requirement 5)
   */
  public rejectMutation(req: Request, res: Response, next: NextFunction): void {
    next(
      new ImmutableResourceError(
        `Transaction Immutability Violation: Transactions cannot be modified or deleted once persisted.`
      )
    );
  }
}

export const transactionController = new TransactionController();
