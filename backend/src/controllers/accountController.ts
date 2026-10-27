import { Request, Response, NextFunction } from 'express';
import { accountService } from '../services/accountService';
import { createAccountSchema } from '../validators/schemas';

export class AccountController {
  public async createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createAccountSchema.parse(req.body);
      const account = await accountService.createAccount(validated);

      res.status(201).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getAccountById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const account = await accountService.getAccountById(id);

      res.status(200).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getAccountBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const balanceData = await accountService.getAccountBalance(id);

      res.status(200).json({
        success: true,
        data: balanceData,
      });
    } catch (error) {
      next(error);
    }
  }

  public async listAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const result = await accountService.listAccounts(page, limit);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public async verifyIntegrity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const integrity = await accountService.verifyBalanceIntegrity(id);

      res.status(200).json({
        success: true,
        data: integrity,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const accountController = new AccountController();
