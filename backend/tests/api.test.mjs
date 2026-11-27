// End-to-end API test: talks to a RUNNING backend over HTTP (no mocks), then cleans up what it created.
//   1) start the API (npm run dev)   2) in another window: npm run test:api
// Env (read from .env by npm run test:api): API_URL, ADMIN_EMAIL, ADMIN_PASSWORD
//
// Note: register/login are limited to 20 requests per 15 minutes per IP, and one run uses 6.
// Running it more than 3 times in 15 minutes shows 429 errors: restart the API (or wait) and run again.
import test from 'node:test';
import assert from 'node:assert/strict';

const API = (process.env.API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: process.env.ADMIN_PASSWORD || 'Admin12345' };
const run = Date.now().toString(36);

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json.data, res };
}
const ok = (r, msg) => assert.ok(r.status >= 200 && r.status < 300, `${msg || 'expected success'}: got ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
const fails = (r, codes, msg) => assert.ok(codes.includes(r.status), `${msg || 'unexpected status'}: expected ${codes.join('/')}, got ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);

const address = { fullName: 'Test Buyer', phone: '20123456', street: '1 Test Street', city: 'Tunis', country: 'Tunisia' };
const S = {}; // state shared by the steps below, in order

test('Atelier API', async (t) => {
  const stock = async () => (await call('GET', `/products/${S.product._id}`)).data.stock;

  await t.test('health check answers', async () => {
    const r = await fetch(API.replace(/\/api\/v1$/, '') + '/health');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).status, 'ok');
  });

  await t.test('register a customer', async () => {
    const email = `qa-${run}@example.test`;
    const r = await call('POST', '/auth/register', { body: { name: 'QA Buyer', email, password: 'Passw0rd!x' } });
    ok(r, 'register');
    S.email = email;
    S.user = r.json.accessToken || r.json.token;
    assert.ok(S.user, 'register returns an access token');
    assert.equal(JSON.stringify(r.json).includes('Passw0rd'), false, 'password must never be returned');
  });

  await t.test('duplicate email is refused', async () => {
    const r = await call('POST', '/auth/register', { body: { name: 'QA Buyer', email: S.email, password: 'Passw0rd!x' } });
    fails(r, [400, 409], 'duplicate register');
  });

  await t.test('wrong password gives 401, right one logs in', async () => {
    fails(await call('POST', '/auth/login', { body: { email: S.email, password: 'wrong-password' } }), [401], 'wrong password');
    const r = await call('POST', '/auth/login', { body: { email: S.email, password: 'Passw0rd!x' } });
    ok(r, 'login');
    assert.ok(r.json.accessToken || r.json.token);
  });

  await t.test('query-operator injection in login is rejected', async () => {
    const r = await call('POST', '/auth/login', { body: { email: { $gt: '' }, password: { $gt: '' } } });
    fails(r, [400, 401], 'NoSQL injection attempt');
  });

  await t.test('admin can log in', async () => {
    const r = await call('POST', '/auth/login', { body: ADMIN });
    ok(r, `admin login (is the admin created? run npm run seed:admin)`);
    S.admin = r.json.accessToken || r.json.token;
  });

  await t.test('access control: customers and guests are kept out', async () => {
    fails(await call('GET', '/cart'), [401], 'cart without token');
    fails(await call('GET', '/orders/my'), [401], 'my orders without token');
    fails(await call('GET', '/me/likes'), [401], 'likes without token');
    fails(await call('POST', '/products', { token: S.user, body: { name: 'x' } }), [403], 'customer creating a product');
    fails(await call('GET', '/users', { token: S.user }), [403], 'customer listing users');
    fails(await call('GET', '/orders', { token: S.user }), [403], 'customer listing all orders');
    fails(await call('GET', '/admin/dashboard/summary', { token: S.user }), [403], 'customer opening the dashboard');
    fails(await call('GET', '/admin/dashboard/summary'), [401], 'guest opening the dashboard');
  });

  await t.test('admin creates a category and a product (bad data is refused)', async () => {
    const c = await call('POST', '/categories', { token: S.admin, body: { name: `QA ${run}` } });
    ok(c, 'create category');
    S.category = c.data;

    const bad = await call('POST', '/products', {
      token: S.admin,
      body: { name: `QA Bad ${run}`, description: 'x', category: S.category._id, price: -5, stock: 1 },
    });
    fails(bad, [400, 422], 'negative price');

    const p = await call('POST', '/products', {
      token: S.admin,
      body: { name: `QA Product ${run}`, description: 'Created by the automated test.', category: S.category._id, price: 10, stock: 5 },
    });
    ok(p, 'create product');
    S.product = p.data;
    assert.equal(await stock(), 5);
  });

  await t.test('public catalogue shows it', async () => {
    const list = await call('GET', `/products?limit=5&category=${S.category._id}`);
    ok(list, 'list products');
    assert.ok(Array.isArray(list.data) && list.json.pagination, 'list has data + pagination');
    assert.ok(list.data.some((p) => p._id === S.product._id), 'new product is listed');
    assert.equal((await call('GET', '/products/000000000000000000000000')).status, 404);
  });

  await t.test('cannot buy more than the stock', async () => {
    const add = await call('POST', '/cart/items', { token: S.user, body: { productId: S.product._id, quantity: 99 } });
    if (add.status < 300) {
      const order = await call('POST', '/orders', { token: S.user, body: { paymentMethod: 'COD', shippingAddress: address } });
      fails(order, [400, 409, 422], 'ordering 99 of 5');
      ok(await call('PUT', `/cart/items/${S.product._id}`, { token: S.user, body: { quantity: 2 } }), 'fix the quantity');
    } else {
      fails(add, [400, 409, 422], 'adding 99 of 5 to the cart');
      ok(await call('POST', '/cart/items', { token: S.user, body: { productId: S.product._id, quantity: 2 } }), 'add 2');
    }
    assert.equal(await stock(), 5, 'a refused order must not touch the stock');
  });

  await t.test('COD order: stock goes down, cart is emptied, starts Pending', async () => {
    const r = await call('POST', '/orders', { token: S.user, body: { paymentMethod: 'COD', shippingAddress: address } });
    ok(r, 'place order');
    S.order = r.data;
    assert.equal(S.order.paymentMethod, 'COD');
    assert.equal(S.order.orderStatus, 'Pending');
    assert.notEqual(S.order.paymentStatus, 'Paid', 'cash on delivery is not paid yet');
    assert.ok(S.order.totalPrice >= 20, 'total covers 2 x 10');
    assert.equal(await stock(), 3);
    const cart = await call('GET', '/cart', { token: S.user });
    assert.equal((cart.data.items || []).length, 0, 'cart is empty after ordering');
  });

  await t.test('cancelling an order gives the stock back', async () => {
    ok(await call('POST', '/cart/items', { token: S.user, body: { productId: S.product._id, quantity: 1 } }), 'add 1');
    const o = await call('POST', '/orders', { token: S.user, body: { paymentMethod: 'COD', shippingAddress: address } });
    ok(o, 'second order');
    assert.equal(await stock(), 2);
    ok(await call('PUT', `/orders/${o.data._id}/cancel`, { token: S.user }), 'cancel');
    assert.equal(await stock(), 3, 'stock restored');
  });

  await t.test('only admins move an order forward, in order, and COD becomes Paid on delivery', async () => {
    const id = S.order._id;
    fails(await call('PUT', `/orders/${id}/status`, { token: S.user, body: { status: 'Confirmed', orderStatus: 'Confirmed' } }), [403], 'customer changing status');
    fails(await call('PUT', `/orders/${id}/status`, { token: S.admin, body: { status: 'Delivered', orderStatus: 'Delivered' } }), [400, 409, 422], 'skipping Confirmed and Shipped');
    for (const s of ['Confirmed', 'Shipped', 'Delivered']) {
      ok(await call('PUT', `/orders/${id}/status`, { token: S.admin, body: { status: s, orderStatus: s } }), `move to ${s}`);
    }
    const o = await call('GET', `/orders/${id}`, { token: S.user });
    assert.equal(o.data.orderStatus, 'Delivered');
    assert.equal(o.data.paymentStatus, 'Paid');
    fails(await call('PUT', `/orders/${id}/status`, { token: S.admin, body: { status: 'Pending', orderStatus: 'Pending' } }), [400, 409, 422], 'moving a delivered order backwards');
  });

  await t.test('reviews: allowed after delivery, once, and the rating is recalculated', async () => {
    const r = await call('POST', `/products/${S.product._id}/reviews`, { token: S.user, body: { rating: 5, comment: 'Great.' } });
    ok(r, 'review');
    S.review = r.data;
    fails(await call('POST', `/products/${S.product._id}/reviews`, { token: S.user, body: { rating: 1 } }), [409], 'second review');
    const p = (await call('GET', `/products/${S.product._id}`)).data;
    assert.equal(p.ratingCount, 1);
    assert.equal(p.ratingAvg, 5);
    ok(await call('DELETE', `/reviews/${S.review._id}`, { token: S.admin }), 'admin deletes review');
    assert.equal((await call('GET', `/products/${S.product._id}`)).data.ratingCount, 0);
  });

  await t.test('admin dashboard answers', async () => {
    for (const p of ['summary', 'revenue', 'payment-split', 'top-products']) {
      ok(await call('GET', `/admin/dashboard/${p}`, { token: S.admin }), `dashboard/${p}`);
    }
  });

  await t.test('cleanup', async () => {
    const p = await call('DELETE', `/products/${S.product._id}`, { token: S.admin });
    ok(p, 'delete product');
    const c = await call('DELETE', `/categories/${S.category._id}`, { token: S.admin });
    ok(c, 'delete category');
    // the QA customer stays (there is no delete-user endpoint); its email is qa-<id>@example.test
  });
});