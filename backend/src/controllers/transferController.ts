import { Request, Response, NextFunction } from 'express';
import { transferService } from '../services/transferService';
import { createTransferSchema } from '../validators/schemas';

export class TransferController {
  public async createTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createTransferSchema.parse(req.body);
      const result = await transferService.executeTransfer(validated);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transferController = new TransferController();
