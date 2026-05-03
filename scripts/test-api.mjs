// Lightweight API validation — runs handlers directly with mock req/res
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_CODE=... PURCHASE_CODE=... node scripts/test-api.mjs

import { createRequire } from 'module';

// Minimal mock for VercelRequest / VercelResponse
function mockReq(method, body = {}, headers = {}, query = {}) {
  return { method, body, headers, query };
}

function mockRes() {
  let _status = 200;
  let _body = null;
  const res = {
    status(code) { _status = code; return res; },
    json(data) { _body = data; return res; },
    setHeader() { return res; },
    get result() { return { status: _status, body: _body }; },
  };
  return res;
}

const ADMIN = process.env.ADMIN_CODE ?? 'testadmin';
const PURCHASE = process.env.PURCHASE_CODE ?? 'testpurchase';
const CRON = process.env.CRON_SECRET ?? 'testcron';

let passed = 0;
let failed = 0;

function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
    || (typeof expected === 'function' && expected(actual));
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    got:      ${JSON.stringify(actual)}`);
    failed++;
  }
}

// Dynamically import compiled handlers via tsx/ts-node shim
// Since we can't run TypeScript directly, compile via tsc first
import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, '.test-build');

console.log('Compiling API handlers for testing...');
mkdirSync(outDir, { recursive: true });

execSync(`npx tsc --outDir ${outDir} --module commonjs --moduleResolution node \
  --esModuleInterop true --target es2020 --skipLibCheck \
  api/_adminAuth.ts api/_db.ts api/_enrichUtils.ts \
  api/admin/verify.ts api/admin/gifts.ts "api/admin/gifts/[id].ts" \
  api/mark-purchased.ts api/gifts.ts`, { cwd: root, stdio: 'pipe' });

// package.json "type":"module" would make .js files ESM; override for the build dir
import { writeFileSync } from 'fs';
writeFileSync(join(outDir, 'package.json'), '{"type":"commonjs"}');

console.log('Compiled. Running tests...\n');

// tsc infers rootDir=api/ so output lands directly in outDir (no api/ subdir).
// Use createRequire so CJS exports.default unwraps correctly from ESM scope.
const req = createRequire(import.meta.url);
const { verifyAdminCode } = req(join(outDir, '_adminAuth.js'));
const adminHandler = req(join(outDir, 'admin/verify.js')).default;
const giftsHandler = req(join(outDir, 'gifts.js')).default;
const createGiftHandler = req(join(outDir, 'admin/gifts.js')).default;
const giftByIdHandler = req(join(outDir, 'admin/gifts/[id].js')).default;
const markPurchasedHandler = req(join(outDir, 'mark-purchased.js')).default;

// ── verifyAdminCode unit tests ──────────────────────────────────────────────
console.log('verifyAdminCode:');
expect('rejects missing auth header',
  verifyAdminCode(mockReq('POST', {}, {})), false);
expect('rejects wrong code',
  verifyAdminCode(mockReq('POST', {}, { authorization: 'Bearer wrong' })), false);
expect('accepts correct code',
  verifyAdminCode(mockReq('POST', {}, { authorization: `Bearer ${ADMIN}` })), true);
expect('rejects non-Bearer scheme',
  verifyAdminCode(mockReq('POST', {}, { authorization: `Basic ${ADMIN}` })), false);

// ── GET /api/gifts ───────────────────────────────────────────────────────────
console.log('\nGET /api/gifts:');
{
  const res = mockRes();
  await giftsHandler(mockReq('GET'), res);
  expect('returns 200', res.result.status, 200);
  expect('body has gifts array', Array.isArray(res.result.body?.gifts), true);
  expect('gifts have expected shape', res.result.body.gifts.every(g =>
    g.id && g.title && Array.isArray(g.links) && typeof g.purchased === 'boolean'
  ), true);
  console.log(`  ℹ ${res.result.body.gifts.length} gifts returned`);
}
{
  const res = mockRes();
  await giftsHandler(mockReq('POST'), res);
  expect('rejects POST with 405', res.result.status, 405);
}

// ── POST /api/admin/verify ───────────────────────────────────────────────────
console.log('\nPOST /api/admin/verify:');
{
  const res = mockRes();
  await adminHandler(mockReq('POST', {}, { authorization: `Bearer ${ADMIN}` }), res);
  expect('correct code → 200', res.result.status, 200);
}
{
  const res = mockRes();
  await adminHandler(mockReq('POST', {}, { authorization: 'Bearer wrong' }), res);
  expect('wrong code → 401', res.result.status, 401);
}
{
  const res = mockRes();
  await adminHandler(mockReq('GET', {}, { authorization: `Bearer ${ADMIN}` }), res);
  expect('GET → 405', res.result.status, 405);
}

// ── POST /api/admin/gifts ────────────────────────────────────────────────────
console.log('\nPOST /api/admin/gifts:');
let createdGiftId = null;
{
  const res = mockRes();
  await createGiftHandler(mockReq('POST', {}, { authorization: 'Bearer wrong' }), res);
  expect('wrong admin code → 401', res.result.status, 401);
}
{
  const res = mockRes();
  await createGiftHandler(mockReq('POST', {}, { authorization: `Bearer ${ADMIN}` }), res);
  expect('missing title → 400', res.result.status, 400);
}
{
  const res = mockRes();
  await createGiftHandler(mockReq('POST', {
    title: 'Test Gift from API Test',
    description: 'Created by test script',
    category: 'other',
    priority: 'low',
    priceRange: '$0',
    links: [],
  }, { authorization: `Bearer ${ADMIN}` }), res);
  expect('valid create → 201', res.result.status, 201);
  expect('returns gift with id', typeof res.result.body?.gift?.id === 'string', true);
  expect('gift has correct title', res.result.body?.gift?.title, 'Test Gift from API Test');
  createdGiftId = res.result.body?.gift?.id;
  console.log(`  ℹ created gift id: ${createdGiftId}`);
}

// ── PUT /api/admin/gifts/[id] ────────────────────────────────────────────────
console.log('\nPUT /api/admin/gifts/[id]:');
{
  const res = mockRes();
  await giftByIdHandler(
    mockReq('PUT', { title: 'Updated Title', category: 'tech', priority: 'high' },
      { authorization: `Bearer ${ADMIN}` }, { id: createdGiftId }),
    res
  );
  expect('valid update → 200', res.result.status, 200);
  expect('title updated', res.result.body?.gift?.title, 'Updated Title');
}
{
  const res = mockRes();
  await giftByIdHandler(
    mockReq('PUT', { title: 'x' }, { authorization: 'Bearer wrong' }, { id: createdGiftId }),
    res
  );
  expect('wrong code → 401', res.result.status, 401);
}
{
  const res = mockRes();
  await giftByIdHandler(
    mockReq('PUT', { title: 'x' }, { authorization: `Bearer ${ADMIN}` }, { id: 'gift-doesnotexist' }),
    res
  );
  expect('nonexistent gift → 404', res.result.status, 404);
}

// ── POST /api/mark-purchased ─────────────────────────────────────────────────
console.log('\nPOST /api/mark-purchased:');
{
  const res = mockRes();
  await markPurchasedHandler(mockReq('POST', { giftId: createdGiftId, purchaseCode: 'wrong' }), res);
  expect('wrong purchase code → 401', res.result.status, 401);
}
{
  const res = mockRes();
  await markPurchasedHandler(mockReq('POST', {}), res);
  expect('missing fields → 400', res.result.status, 400);
}
{
  const res = mockRes();
  await markPurchasedHandler(mockReq('POST', { giftId: createdGiftId, purchaseCode: PURCHASE }), res);
  expect('correct code → 200', res.result.status, 200);
}
{
  const res = mockRes();
  await markPurchasedHandler(mockReq('POST', { giftId: createdGiftId, purchaseCode: PURCHASE }), res);
  expect('already purchased → 409', res.result.status, 409);
}

// ── DELETE /api/admin/gifts/[id] — cleanup ───────────────────────────────────
console.log('\nDELETE /api/admin/gifts/[id]:');
{
  const res = mockRes();
  await giftByIdHandler(
    mockReq('DELETE', {}, { authorization: `Bearer ${ADMIN}` }, { id: createdGiftId }),
    res
  );
  expect('delete test gift → 200', res.result.status, 200);
}
{
  // Confirm it's gone
  const res = mockRes();
  await giftByIdHandler(
    mockReq('DELETE', {}, { authorization: `Bearer ${ADMIN}` }, { id: createdGiftId }),
    res
  );
  expect('deleting again → 404', res.result.status, 404);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);

// Cleanup build dir
import { rmSync } from 'fs';
rmSync(outDir, { recursive: true, force: true });

process.exit(failed > 0 ? 1 : 0);
