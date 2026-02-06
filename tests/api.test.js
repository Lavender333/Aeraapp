import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let mongod;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'aera_test' });
  app = (await import('../server.js')).app;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Auth + Org + Members API', () => {
  it('registers and logs in a user', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'SecurePass123!',
        fullName: 'Admin User',
        role: 'ADMIN',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.accessToken).toBeTypeOf('string');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'SecurePass123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeTypeOf('string');
  });

  it('creates organization and lists in public directory', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'SecurePass123!' });

    const token = loginRes.body.accessToken;

    const createRes = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Grace Community Church',
        type: 'CHURCH',
        address: '456 Faith Avenue',
        adminContact: 'Pastor John',
        adminPhone: '555-0101',
        verified: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('Grace Community Church');

    const listRes = await request(app).get('/api/organizations?limit=10&page=1');
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThan(0);
  });

  it('paginates members list', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'SecurePass123!' });

    const token = loginRes.body.accessToken;

    const orgList = await request(app).get('/api/organizations');
    const orgId = orgList.body.items[0]._id;

    await request(app)
      .post(`/api/orgs/${orgId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Member One', status: 'SAFE' });

    await request(app)
      .post(`/api/orgs/${orgId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Member Two', status: 'DANGER' });

    const page1 = await request(app)
      .get(`/api/orgs/${orgId}/members?page=1&limit=1`)
      .set('Authorization', `Bearer ${token}`);

    const page2 = await request(app)
      .get(`/api/orgs/${orgId}/members?page=2&limit=1`)
      .set('Authorization', `Bearer ${token}`);

    expect(page1.status).toBe(200);
    expect(page1.body.items.length).toBe(1);
    expect(page2.status).toBe(200);
    expect(page2.body.items.length).toBe(1);
  });
});
