import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import { Application } from 'express';

describe('Concurrency and Race-Condition Protection', () => {
  let app: Application;

  beforeAll(async () => {
    await db.initDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should handle simultaneous concurrent debit attempts without overdrafting', async () => {
    // 1. Create an account with balance 100
    const acc = await request(app).post('/api/v1/accounts').send({ name: 'Race Condition Test' });
    const accId = acc.body.data.id;

    await request(app).post(`/api/v1/accounts/${accId}/transactions`).send({
      type: 'credit',
      amount: 100,
      reference_id: 'RACE-INITIAL-100',
    });

    // 2. Fire 5 simultaneous debit requests of 30 each concurrently.
    // Total requested = 150. Since balance is only 100, at most 3 can succeed (3 x 30 = 90),
    // and the remaining 2 MUST be rejected with 422!
    const promises = [1, 2, 3, 4, 5].map((i) =>
      request(app)
        .post(`/api/v1/accounts/${accId}/transactions`)
        .send({
          type: 'debit',
          amount: 30,
          description: `Concurrent debit ${i}`,
          reference_id: `RACE-DEBIT-${i}`,
        })
    );

    const responses = await Promise.all(promises);
    const successCount = responses.filter((r) => r.status === 201).length;
    const rejectedCount = responses.filter((r) => r.status === 422).length;

    // Exactly 3 succeeded and 2 rejected
    expect(successCount).toBe(3);
    expect(rejectedCount).toBe(2);

    // Final balance must be exactly 10.0 (100 - 90)
    const balRes = await request(app).get(`/api/v1/accounts/${accId}/balance`);
    expect(balRes.body.data.balance).toBe(10);

    // Verify balance integrity matches ledger
    const integrityRes = await request(app).get(`/api/v1/accounts/${accId}/verify-integrity`);
    expect(integrityRes.body.data.consistent).toBe(true);
    expect(integrityRes.body.data.stored_balance).toBe(10);
    expect(integrityRes.body.data.calculated_balance).toBe(10);
  }, 20000);
});
