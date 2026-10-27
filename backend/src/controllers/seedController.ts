import { Request, Response, NextFunction } from 'express';
import { accountService } from '../services/accountService';
import { transactionService } from '../services/transactionService';
import { transferService } from '../services/transferService';

export async function seedDemoData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Create Demo Accounts
    const alice = await accountService.createAccount({ name: 'Alice Walker' });
    const bob = await accountService.createAccount({ name: 'Bob Martinez' });
    const charlie = await accountService.createAccount({ name: 'Charlie Kim' });

    // 2. Perform Initial Credits
    await transactionService.addTransaction({
      account_id: alice.id,
      type: 'credit',
      amount: 1500.00,
      description: 'Initial deposit & payroll credit',
      reference_id: `DEP-ALICE-${Date.now()}-1`,
    });

    await transactionService.addTransaction({
      account_id: bob.id,
      type: 'credit',
      amount: 800.00,
      description: 'Freelance invoice payment',
      reference_id: `DEP-BOB-${Date.now()}-1`,
    });

    await transactionService.addTransaction({
      account_id: charlie.id,
      type: 'credit',
      amount: 450.00,
      description: 'Consulting stipend',
      reference_id: `DEP-CHARLIE-${Date.now()}-1`,
    });

    // 3. Perform Debits
    await transactionService.addTransaction({
      account_id: alice.id,
      type: 'debit',
      amount: 120.50,
      description: 'Grocery store supermarket purchase',
      reference_id: `DEB-ALICE-${Date.now()}-2`,
    });

    await transactionService.addTransaction({
      account_id: bob.id,
      type: 'debit',
      amount: 45.00,
      description: 'Cloud hosting subscription',
      reference_id: `DEB-BOB-${Date.now()}-2`,
    });

    // 4. Perform an Atomic Money Transfer between Alice and Bob
    await transferService.executeTransfer({
      source_account_id: alice.id,
      destination_account_id: bob.id,
      amount: 250.00,
      description: 'Conference ticket reimbursement',
      reference_id: `TRF-${Date.now()}-1`,
    });

    res.status(200).json({
      success: true,
      message: 'Demo dataset successfully seeded',
      data: {
        accounts_created: [alice, bob, charlie],
      },
    });
  } catch (error) {
    next(error);
  }
}
