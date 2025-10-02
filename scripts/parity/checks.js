#!/usr/bin/env node
/*
 Parity checks for Zabava Next API
 Usage:
   API_BASE_URL=https://your-app.vercel.app FRONTEND_ORIGIN=https://your-frontend.vercel.app \
   ADMIN_SECRET=... PARTNER_JWT=... TEST_EMAIL=user@example.com TEST_PARTNER_ID=demo \
   REWARD_ID=... REDEMPTION_CODE=... node scripts/parity/checks.js
*/

const https = require('https');
const http = require('http');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const PARTNER_JWT = process.env.PARTNER_JWT || '';
const TEST_EMAIL = process.env.TEST_EMAIL || `test${Date.now()}@example.com`;
const TEST_PARTNER_ID = process.env.TEST_PARTNER_ID || 'demo-partner';
const REWARD_ID = process.env.REWARD_ID || '';
const REDEMPTION_CODE = process.env.REDEMPTION_CODE || '';

function makeRequest({ method, path, headers = {}, body }) {
  const url = new URL(API_BASE_URL + path);
  const isHttps = url.protocol === 'https:';
  const reqOpts = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method,
    headers: {
      'Accept': 'application/json',
      'Origin': FRONTEND_ORIGIN,
      ...headers,
    },
  };
  const proto = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const req = proto.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function test(name, fn) {
  process.stdout.write(`- ${name} ... `);
  try {
    await fn();
    console.log('OK');
  } catch (e) {
    console.log('FAIL');
    console.error(`  ${e.message}`);
  }
}

(async () => {
  console.log('Running Zabava API parity checks');
  console.log(`Base: ${API_BASE_URL}`);

  await test('GET /api/health', async () => {
    const r = await makeRequest({ method: 'GET', path: '/api/health' });
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });

  await test('GET /api/bonus/user-points', async () => {
    const r = await makeRequest({ method: 'GET', path: `/api/bonus/user-points?email=${encodeURIComponent(TEST_EMAIL)}` });
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (!r.json || !r.json.user) throw new Error('missing user in response');
  });

  if (REWARD_ID) {
    await test('POST /api/bonus/redeem-reward', async () => {
      const r = await makeRequest({ method: 'POST', path: '/api/bonus/redeem-reward', headers: { 'Content-Type': 'application/json' }, body: { email: TEST_EMAIL, rewardId: REWARD_ID, partnerId: TEST_PARTNER_ID } });
      if (![200, 400, 404].includes(r.status)) throw new Error(`status ${r.status}`);
    });
  }

  await test('GET /api/admin/overview unauthorized', async () => {
    const r = await makeRequest({ method: 'GET', path: '/api/admin/overview' });
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
  });

  if (ADMIN_SECRET) {
    await test('GET /api/admin/overview authorized', async () => {
      const r = await makeRequest({ method: 'GET', path: '/api/admin/overview', headers: { 'x-admin-secret': ADMIN_SECRET } });
      if (r.status !== 200) throw new Error(`status ${r.status}`);
    });
  }

  if (REDEMPTION_CODE) {
    await test('GET /api/partner/check-redemption', async () => {
      const headers = PARTNER_JWT ? { Authorization: `Bearer ${PARTNER_JWT}` } : {};
      const r = await makeRequest({ method: 'GET', path: `/api/partner/check-redemption?code=${encodeURIComponent(REDEMPTION_CODE)}`, headers });
      if (![200, 403, 404].includes(r.status)) throw new Error(`status ${r.status}`);
    });
  }

  if (PARTNER_JWT) {
    await test('POST /api/partner/visit (authorized)', async () => {
      const body = { email: TEST_EMAIL, partnerId: TEST_PARTNER_ID, payload: { ticket: 'Standard', numPeople: 1 } };
      const r = await makeRequest({ method: 'POST', path: '/api/partner/visit', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PARTNER_JWT}` }, body });
      if (r.status !== 200) throw new Error(`status ${r.status}`);
      if (!r.json || !r.json.success) throw new Error('missing success');
    });
  }

  console.log('Parity checks completed');
})();
