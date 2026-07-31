import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createRequestRateLimiter, requestRateLimitConfig, trustProxyHops } from './request-rate-limit.js';

test('dùng giá trị mặc định và bỏ qua cấu hình môi trường không hợp lệ', () => {
  const config = requestRateLimitConfig({
    RATE_LIMIT_API_WINDOW_MS: '-1',
    RATE_LIMIT_API_MAX: 'abc',
    RATE_LIMIT_LOGIN_MAX: '0',
    RATE_LIMIT_WRITE_MAX: '999999',
  });
  assert.equal(config.api.windowMs, 60_000);
  assert.equal(config.api.limit, 180);
  assert.equal(config.login.limit, 5);
  assert.equal(config.ownerWrite.limit, 10_000);
});

test('đọc số proxy hop an toàn cho Vercel và self-hosted', () => {
  assert.equal(trustProxyHops({ VERCEL: '1' }), 1);
  assert.equal(trustProxyHops({ TRUST_PROXY_HOPS: '3' }), 3);
  assert.equal(trustProxyHops({ TRUST_PROXY_HOPS: '0' }), 0);
});

test('trả 429, Retry-After và JSON chuẩn khi vượt giới hạn', async () => {
  const app = express();
  app.use(createRequestRateLimiter({ windowMs: 1_000, limit: 2, message: 'Chậm lại.' }));
  app.get('/resource', (_request, response) => response.json({ success: true }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });

  try {
    const address = server.address();
    assert.equal(typeof address, 'object');
    const url = `http://127.0.0.1:${address.port}/resource`;
    const responses = await Promise.all([fetch(url), fetch(url), fetch(url)]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 200, 429]);
    const blocked = responses.find(response => response.status === 429);
    assert.ok(blocked.headers.get('ratelimit'));
    assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
    const body = await blocked.json();
    assert.equal(body.code, 'RATE_LIMITED');
    assert.equal(body.message, 'Chậm lại.');
    assert.ok(body.retryAfterSeconds >= 1);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('đăng nhập thành công không tiêu thụ quota lỗi', async () => {
  const app = express();
  app.use(createRequestRateLimiter({ windowMs: 1_000, limit: 1, message: 'Chậm lại.', skipSuccessfulRequests: true }));
  app.get('/login', (request, response) => response.sendStatus(request.query.valid === '1' ? 200 : 401));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });

  try {
    const address = server.address();
    assert.equal(typeof address, 'object');
    const url = `http://127.0.0.1:${address.port}/login`;
    assert.equal((await fetch(`${url}?valid=1`)).status, 200);
    assert.equal((await fetch(`${url}?valid=0`)).status, 401);
    assert.equal((await fetch(`${url}?valid=0`)).status, 429);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
