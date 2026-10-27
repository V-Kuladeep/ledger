import { Router } from 'express';
import { transferController } from '../controllers/transferController';

const router = Router();

router.post('/', transferController.createTransfer.bind(transferController));

export default router;
