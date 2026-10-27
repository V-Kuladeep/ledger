import { Router } from 'express';
import { transactionController } from '../controllers/transactionController';

const router = Router();

// Add transaction (body contains account_id)
router.post('/', transactionController.addTransaction.bind(transactionController));

// Transaction Immutability enforcement (Reject updates and deletes)
router.put('/:id', transactionController.rejectMutation.bind(transactionController));
router.patch('/:id', transactionController.rejectMutation.bind(transactionController));
router.delete('/:id', transactionController.rejectMutation.bind(transactionController));

export default router;
