// Load test for the public read paths. Usage:  npm run load   (defaults to the API on this PC)
//   LOAD_URL=http://localhost       -> test through Nginx (shows the edge rate limit and load balancing)
//   LOAD_URL=http://localhost:5000  -> test one API directly (needs API_RATE_LIMIT=1000000 on the API, see DEPLOYMENT.md)
//   DURATION=15 CONNECTIONS=50 P99_MS=800
import autocannon from 'autocannon';

const BASE = (process.env.LOAD_URL || 'http://localhost:5000').replace(/\/$/, '');
const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const DURATION = num(process.env.DURATION, 10);
const CONNECTIONS = num(process.env.CONNECTIONS, 40);
const P99_MS = num(process.env.P99_MS, 800);

const targets = [
  { name: 'GET /health', path: '/health' },
  { name: 'GET /api/v1/categories', path: '/api/v1/categories' },
  { name: 'GET /api/v1/products (page 1)', path: '/api/v1/products?page=1&limit=12' },
  { name: 'GET /api/v1/products (search)', path: '/api/v1/products?search=a&limit=12' },
];

const run = (t) =>
  new Promise((resolve, reject) => {
    const inst = autocannon({ url: BASE + t.path, connections: CONNECTIONS, duration: DURATION, headers: { Accept: 'application/json' } }, (err, res) => (err ? reject(err) : resolve(res)));
    autocannon.track(inst, { renderProgressBar: false, renderResultsTable: false, renderLatencyTable: false });
  });

console.log('errors = 5xx, timeouts, connection errors and any 4xx other than 429.');
console.log(`Load test on ${BASE}: ${CONNECTIONS} connections for ${DURATION}s per endpoint, p99 limit ${P99_MS} ms\n`);
let failed = false;
const rows = [];
for (const t of targets) {
  const r = await run(t);
  const limited = r.statusCodeStats?.['429']?.count || 0; // 429 is a rate limiter doing its job, not a failure
  const wrong = (r['4xx'] || 0) - limited; // any other 4xx (404, 401...) means the test itself is pointed at the wrong thing
  const bad = (r['5xx'] || 0) + r.errors + r.timeouts + wrong;
  const slow = r.latency.p99 > P99_MS;
  if (bad > 0 || slow) failed = true;
  rows.push({
    endpoint: t.name,
    'req/s': Math.round(r.requests.average),
    'p50 ms': r.latency.p50,
    'p99 ms': r.latency.p99,
    ok: r['2xx'],
    'limited (429)': limited,
    'errors': bad,
    result: bad > 0 ? (wrong > 0 ? 'FAIL unexpected 4xx' : 'FAIL errors') : slow ? 'FAIL slow' : 'pass',
  });
}
console.table(rows);
if (rows.some((r) => r['limited (429)'] > 0 && r.ok === 0)) {
  console.log('Everything was rate limited (429). That is the limiter working: raise API_RATE_LIMIT on the API for a capacity test, see DEPLOYMENT.md.');
}
console.log(failed ? 'LOAD TEST FAILED' : 'LOAD TEST PASSED');
process.exit(failed ? 1 : 0);