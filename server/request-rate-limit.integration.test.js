import assert from 'node:assert/strict';
import test from 'node:test';

process.env.VERCEL = '1';
process.env.RATE_LIMIT_API_WINDOW_MS = '1000';
process.env.RATE_LIMIT_API_MAX = '4';
process.env.RATE_LIMIT_LOGIN_WINDOW_MS = '1000';
process.env.RATE_LIMIT_LOGIN_MAX = '1';
process.env.RATE_LIMIT_WRITE_WINDOW_MS = '1000';
process.env.RATE_LIMIT_WRITE_MAX = '1';
process.env.OWNER_PASSWORDS = 'test-password';
process.env.OWNER_SESSION_SECRET = 'test-session-secret-with-enough-entropy';

test('Express app áp dụng đúng limiter theo lớp và miễn health check', async () => {
  const { default: app } = await import('../server.js');
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });

  try {
    const address = server.address();
    assert.equal(typeof address, 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    for (let count = 0; count < 6; count++) {
      assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
    }

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'test-password' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);

    const firstWrite = await fetch(`${baseUrl}/api/upload`, { method: 'POST', headers: { cookie } });
    assert.equal(firstWrite.status, 410);
    const blockedWrite = await fetch(`${baseUrl}/api/upload`, { method: 'POST', headers: { cookie } });
    assert.equal(blockedWrite.status, 429);
    assert.equal((await blockedWrite.json()).code, 'RATE_LIMITED');

    assert.equal((await fetch(`${baseUrl}/api/auth/verify`)).status, 200);
    const globallyBlocked = await fetch(`${baseUrl}/api/auth/verify`);
    assert.equal(globallyBlocked.status, 429);
    assert.equal((await globallyBlocked.json()).code, 'RATE_LIMITED');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
