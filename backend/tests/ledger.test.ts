import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import { Application } from 'express';

describe('Transaction Ledger API Test Suite', () => {
  let app: Application;

  beforeAll(async () => {
    // Initialize in-memory or test database
    await db.initDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('1. Create Account', () => {
    it('should create an account with balance 0 and system generated created_at', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'John Doe' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('John Doe');
      expect(res.body.data.balance).toBe(0);
      expect(res.body.data.created_at).toBeDefined();
    });

    it('should reject if name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject if client attempts to provide initial balance', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'Hacker Account', balance: 5000 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Transactions & Balance Management', () => {
    let testAccountId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'Jane Ledger' });
      testAccountId = res.body.data.id;
    });

    it('should successfully credit an account and update balance', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccountId}/transactions`)
        .send({
          type: 'credit',
          amount: 100.0,
          description: 'Initial deposit',
          reference_id: 'REF-DEP-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.new_balance).toBe(100.0);
      expect(res.body.data.transaction.reference_id).toBe('REF-DEP-001');

      // Verify via balance endpoint
      const balRes = await request(app).get(`/api/v1/accounts/${testAccountId}/balance`);
      expect(balRes.status).toBe(200);
      expect(balRes.body.data.balance).toBe(100.0);
    });

    it('should successfully debit an account when balance is sufficient', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccountId}/transactions`)
        .send({
          type: 'debit',
          amount: 30.0,
          description: 'Coffee purchase',
          reference_id: 'REF-DEB-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.new_balance).toBe(70.0);

      // Verify balance
      const balRes = await request(app).get(`/api/v1/accounts/${testAccountId}/balance`);
      expect(balRes.body.data.balance).toBe(70.0);
    });

    it('should reject a debit transaction when balance is insufficient and leave balance unchanged', async () => {
      // Current balance is 70.0, attempting to debit 150.0
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccountId}/transactions`)
        .send({
          type: 'debit',
          amount: 150.0,
          description: 'Expensive laptop',
          reference_id: 'REF-DEB-EXCESS',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

      // Verify balance remains 70.0
      const balRes = await request(app).get(`/api/v1/accounts/${testAccountId}/balance`);
      expect(balRes.body.data.balance).toBe(70.0);
    });

    it('should reject duplicate reference_id for the same account without changing balance', async () => {
      // Re-submitting 'REF-DEP-001' which was previously used on this account
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccountId}/transactions`)
        .send({
          type: 'credit',
          amount: 50.0,
          description: 'Duplicate retry attempt',
          reference_id: 'REF-DEP-001',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_TRANSACTION');

      // Verify balance unchanged
      const balRes = await request(app).get(`/api/v1/accounts/${testAccountId}/balance`);
      expect(balRes.body.data.balance).toBe(70.0);
    });

    it('should allow the same reference_id to be used for a DIFFERENT account', async () => {
      // Create a second account
      const acc2 = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'Bob Second' });
      const acc2Id = acc2.body.data.id;

      // Use 'REF-DEP-001' on this different account
      const res = await request(app)
        .post(`/api/v1/accounts/${acc2Id}/transactions`)
        .send({
          type: 'credit',
          amount: 200.0,
          description: 'Valid credit with same reference on different account',
          reference_id: 'REF-DEP-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.new_balance).toBe(200.0);
    });

    it('should return 404 for transaction on non-existent account', async () => {
      const res = await request(app)
        .post('/api/v1/accounts/non-existent-uuid/transactions')
        .send({
          type: 'credit',
          amount: 100.0,
          reference_id: 'REF-GHOST',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject invalid amount <= 0', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccountId}/transactions`)
        .send({
          type: 'credit',
          amount: -50.0,
          reference_id: 'REF-NEG',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid transaction type', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccountId}/transactions`)
        .send({
          type: 'refund',
          amount: 50.0,
          reference_id: 'REF-TYPE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. Transaction History, Filtering & Pagination', () => {
    let historyAccountId: string;

    beforeAll(async () => {
      const acc = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'History Test Account' });
      historyAccountId = acc.body.data.id;

      // Create 5 transactions: 3 credits, 2 debits
      await request(app).post(`/api/v1/accounts/${historyAccountId}/transactions`).send({
        type: 'credit',
        amount: 100,
        reference_id: 'HIST-C-1',
      });
      await request(app).post(`/api/v1/accounts/${historyAccountId}/transactions`).send({
        type: 'credit',
        amount: 200,
        reference_id: 'HIST-C-2',
      });
      await request(app).post(`/api/v1/accounts/${historyAccountId}/transactions`).send({
        type: 'debit',
        amount: 50,
        reference_id: 'HIST-D-1',
      });
      await request(app).post(`/api/v1/accounts/${historyAccountId}/transactions`).send({
        type: 'credit',
        amount: 300,
        reference_id: 'HIST-C-3',
      });
      await request(app).post(`/api/v1/accounts/${historyAccountId}/transactions`).send({
        type: 'debit',
        amount: 70,
        reference_id: 'HIST-D-2',
      });
    });

    it('should return all transactions sorted latest-first when no type filter is specified', async () => {
      const res = await request(app).get(`/api/v1/accounts/${historyAccountId}/transactions`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(5);
      expect(res.body.data.pagination.total_records).toBe(5);
      // Latest-first check: the last created transaction should be first in the array
      expect(res.body.data.items[0].reference_id).toBe('HIST-D-2');
    });

    it('should filter transactions by type credit', async () => {
      const res = await request(app).get(
        `/api/v1/accounts/${historyAccountId}/transactions?type=credit`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(3);
      res.body.data.items.forEach((item: any) => {
        expect(item.type).toBe('credit');
      });
    });

    it('should filter transactions by type debit', async () => {
      const res = await request(app).get(
        `/api/v1/accounts/${historyAccountId}/transactions?type=debit`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
      res.body.data.items.forEach((item: any) => {
        expect(item.type).toBe('debit');
      });
    });

    it('should handle pagination parameters accurately', async () => {
      const res = await request(app).get(
        `/api/v1/accounts/${historyAccountId}/transactions?page=1&limit=2`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.pagination.current_page).toBe(1);
      expect(res.body.data.pagination.page_size).toBe(2);
      expect(res.body.data.pagination.total_records).toBe(5);
      expect(res.body.data.pagination.total_pages).toBe(3);
    });
  });

  describe('4. Transaction Immutability & Data Consistency', () => {
    it('should reject modification (PUT / PATCH) or deletion (DELETE) on transactions with 405', async () => {
      const putRes = await request(app)
        .put('/api/v1/transactions/some-tx-id')
        .send({ amount: 999 });
      expect(putRes.status).toBe(405);
      expect(putRes.body.error.code).toBe('TRANSACTION_IMMUTABLE');

      const delRes = await request(app).delete('/api/v1/transactions/some-tx-id');
      expect(delRes.status).toBe(405);
      expect(delRes.body.error.code).toBe('TRANSACTION_IMMUTABLE');
    });

    it('should verify balance consistency against the sum of all transaction logs', async () => {
      // Create account
      const acc = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'Consistency Check' });
      const accId = acc.body.data.id;

      // Credit 100, Credit 50, Debit 30, Debit 20 -> expected: 100
      await request(app).post(`/api/v1/accounts/${accId}/transactions`).send({
        type: 'credit',
        amount: 100,
        reference_id: 'CONS-C-1',
      });
      await request(app).post(`/api/v1/accounts/${accId}/transactions`).send({
        type: 'credit',
        amount: 50,
        reference_id: 'CONS-C-2',
      });
      await request(app).post(`/api/v1/accounts/${accId}/transactions`).send({
        type: 'debit',
        amount: 30,
        reference_id: 'CONS-D-1',
      });
      await request(app).post(`/api/v1/accounts/${accId}/transactions`).send({
        type: 'debit',
        amount: 20,
        reference_id: 'CONS-D-2',
      });

      const integrityRes = await request(app).get(`/api/v1/accounts/${accId}/verify-integrity`);
      expect(integrityRes.status).toBe(200);
      expect(integrityRes.body.data.stored_balance).toBe(100);
      expect(integrityRes.body.data.calculated_balance).toBe(100);
      expect(integrityRes.body.data.consistent).toBe(true);
    });
  });

  describe('5. Bonus: Money Transfer API', () => {
    let accA: string;
    let accB: string;

    beforeAll(async () => {
      const resA = await request(app).post('/api/v1/accounts').send({ name: 'Account A' });
      const resB = await request(app).post('/api/v1/accounts').send({ name: 'Account B' });
      accA = resA.body.data.id;
      accB = resB.body.data.id;

      // Fund Account A with 100, Account B with 50 (matching assessment example)
      await request(app).post(`/api/v1/accounts/${accA}/transactions`).send({
        type: 'credit',
        amount: 100,
        reference_id: 'INIT-A',
      });
      await request(app).post(`/api/v1/accounts/${accB}/transactions`).send({
        type: 'credit',
        amount: 50,
        reference_id: 'INIT-B',
      });
    });

    it('should transfer 30 from Account A to Account B atomically (resulting in 70 and 80)', async () => {
      const res = await request(app).post('/api/v1/transfers').send({
        source_account_id: accA,
        destination_account_id: accB,
        amount: 30,
        reference_id: 'TRF-TEST-30',
        description: 'Settling lunch bill',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.source_new_balance).toBe(70);
      expect(res.body.data.destination_new_balance).toBe(80);

      // Verify source account balance
      const balA = await request(app).get(`/api/v1/accounts/${accA}/balance`);
      expect(balA.body.data.balance).toBe(70);

      // Verify destination account balance
      const balB = await request(app).get(`/api/v1/accounts/${accB}/balance`);
      expect(balB.body.data.balance).toBe(80);
    });

    it('should reject transfer when source account has insufficient balance and rollback completely', async () => {
      // Account A currently has 70. Attempt to transfer 100
      const res = await request(app).post('/api/v1/transfers').send({
        source_account_id: accA,
        destination_account_id: accB,
        amount: 100,
        reference_id: 'TRF-FAIL-EXCESS',
      });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

      // Verify neither balance changed
      const balA = await request(app).get(`/api/v1/accounts/${accA}/balance`);
      expect(balA.body.data.balance).toBe(70);

      const balB = await request(app).get(`/api/v1/accounts/${accB}/balance`);
      expect(balB.body.data.balance).toBe(80);
    });
  });
});
