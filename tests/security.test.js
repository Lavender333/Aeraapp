import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let mongod;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_MAX_ATTEMPTS = '3';
  process.env.AUTH_LOCK_MINUTES = '5';
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'aera_test' });
  app = (await import('../server.js')).app;

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: 'lockout@example.com',
      password: 'SecurePass123!',
      fullName: 'Lockout User',
      role: 'GENERAL_USER',
    });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Security checks', () => {
  it('rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'weak@example.com',
        password: 'weakpass',
      });

    expect(res.status).toBe(400);
  });

  it('locks account after repeated failures', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lockout@example.com', password: 'WrongPass1!' });

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lockout@example.com', password: 'WrongPass1!' });

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lockout@example.com', password: 'WrongPass1!' });

    const locked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lockout@example.com', password: 'SecurePass123!' });

    expect(locked.status).toBe(423);
  });
});
