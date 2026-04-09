// backend/src/__tests__/transaction.test.js

const request = require('supertest');
const app     = require('../../server-test');

describe('💰 Transaction API', () => {

  let accessToken;
  let transactionId;

  const testUser = {
    name: 'Transaction Tester', email: 'txn@spendwise.com', password: 'Test@1234',
  };

  const testTransaction = {
    type:          'expense',
    amount:        500,
    merchant:      'Swiggy',
    categoryName:  'Food & Dining',
    paymentMethod: 'upi',
    date:          new Date().toISOString(),
  };

  beforeEach(async () => {
    const reg   = await request(app).post('/api/auth/register').send(testUser);
    accessToken = reg.body.data.accessToken;
  });

  //─────────────────────────────────────
  // CREATE
  //─────────────────────────────────────
  describe('POST /api/transactions', () => {
    it('should create a transaction successfully', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testTransaction);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe(500);
      expect(res.body.data.transaction.merchant).toBe('Swiggy');

      transactionId = res.body.data.transaction._id;
    });

    it('should reject transaction without amount', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ type: 'expense' });

      expect(res.status).toBe(422);
    });

    it('should reject negative amount', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...testTransaction, amount: -100 });

      expect(res.status).toBe(422);
    });

    it('should reject invalid type', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...testTransaction, type: 'invalid' });

      expect(res.status).toBe(422);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .send(testTransaction);

      expect(res.status).toBe(401);
    });
  });

  //─────────────────────────────────────
  // GET LIST
  //─────────────────────────────────────
  describe('GET /api/transactions', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testTransaction);
    });

    it('should return transactions list', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions).toHaveLength(1);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should filter by type', async () => {
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...testTransaction, type: 'income', amount: 5000 });

      const res = await request(app)
        .get('/api/transactions?type=income')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.every(t => t.type === 'income')).toBe(true);
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/transactions?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(5);
    });
  });

  //─────────────────────────────────────
  // GET SINGLE
  //─────────────────────────────────────
  describe('GET /api/transactions/:id', () => {
    beforeEach(async () => {
      const res   = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testTransaction);
      transactionId = res.body.data.transaction._id;
    });

    it('should return single transaction', async () => {
      const res = await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transaction._id).toBe(transactionId);
    });

    it('should return 404 for non-existent transaction', async () => {
      const res = await request(app)
        .get('/api/transactions/000000000000000000000000')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  //─────────────────────────────────────
  // UPDATE
  //─────────────────────────────────────
  describe('PUT /api/transactions/:id', () => {
    beforeEach(async () => {
      const res   = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testTransaction);
      transactionId = res.body.data.transaction._id;
    });

    it('should update transaction amount', async () => {
      const res = await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 750 });

      expect(res.status).toBe(200);
      expect(res.body.data.transaction.amount).toBe(750);
    });
  });

  //─────────────────────────────────────
  // DELETE
  //─────────────────────────────────────
  describe('DELETE /api/transactions/:id', () => {
    beforeEach(async () => {
      const res   = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testTransaction);
      transactionId = res.body.data.transaction._id;
    });

    it('should soft delete transaction', async () => {
      const res = await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Should not appear in list
      const list = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(list.body.data.transactions).toHaveLength(0);
    });
  });

  //─────────────────────────────────────
  // SUMMARY
  //─────────────────────────────────────
  describe('GET /api/transactions/summary', () => {
    it('should return monthly summary', async () => {
      const now = new Date();
      const res = await request(app)
        .get(`/api/transactions/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
    });
  });
});