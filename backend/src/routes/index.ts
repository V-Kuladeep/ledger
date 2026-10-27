import { Router, Request, Response } from 'express';
import accountRoutes from './accountRoutes';
import transactionRoutes from './transactionRoutes';
import transferRoutes from './transferRoutes';
import { seedDemoData } from '../controllers/seedController';

const router = Router();

router.use('/accounts', accountRoutes);
router.use('/transactions', transactionRoutes);
router.use('/transfers', transferRoutes);
router.post('/seed', seedDemoData);

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'transaction-ledger-api',
  });
});

export default router;
