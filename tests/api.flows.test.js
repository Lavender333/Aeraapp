import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let mongod;
let token;
let orgId;
let memberId;
let requestId;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'aera_test' });
  app = (await import('../server.js')).app;

  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: 'admin2@example.com',
      password: 'SecurePass123!',
      fullName: 'Admin Two',
      role: 'ADMIN',
    });

  token = registerRes.body.accessToken;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Org flow', () => {
  it('creates and updates organization', async () => {
    const createRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Org',
        type: 'NGO',
        address: '123 Test Way',
        adminContact: 'Test Admin',
      });

    expect(createRes.status).toBe(201);
    orgId = createRes.body._id;

    const updateRes = await request(app)
      .put(`/api/v1/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ address: '456 Updated Ave' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.address).toBe('456 Updated Ave');
  });
});

describe('Member + Request flow', () => {
  it('creates, lists, updates, and deletes a member', async () => {
    const createRes = await request(app)
      .post(`/api/v1/orgs/${orgId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Member Alpha', status: 'SAFE' });

    expect(createRes.status).toBe(201);
    memberId = createRes.body.id;

    const listRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/members?page=1&limit=10`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThan(0);

    const updateRes = await request(app)
      .put(`/api/v1/orgs/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DANGER' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('DANGER');

    const deleteRes = await request(app)
      .delete(`/api/v1/orgs/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
  });

  it('creates and updates a replenishment request', async () => {
    const createRes = await request(app)
      .post(`/api/v1/orgs/${orgId}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({ item: 'Water Cases', quantity: 10, provider: 'Test Provider' });

    expect(createRes.status).toBe(201);
    requestId = createRes.body._id;

    const updateRes = await request(app)
      .post(`/api/v1/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPROVED' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('APPROVED');
  });
});
