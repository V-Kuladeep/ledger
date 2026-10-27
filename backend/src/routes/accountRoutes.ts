import { Router } from 'express';
import { accountController } from '../controllers/accountController';
import { transactionController } from '../controllers/transactionController';

const router = Router();

// Account endpoints
router.post('/', accountController.createAccount.bind(accountController));
router.get('/', accountController.listAccounts.bind(accountController));
router.get('/:id', accountController.getAccountById.bind(accountController));
router.get('/:id/balance', accountController.getAccountBalance.bind(accountController));
router.get('/:id/verify-integrity', accountController.verifyIntegrity.bind(accountController));

// Sub-resource transaction endpoints on account
router.post('/:id/transactions', transactionController.addTransaction.bind(transactionController));
router.get('/:id/transactions', transactionController.getTransactionHistory.bind(transactionController));

export default router;
