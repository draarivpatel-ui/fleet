// Run the fan-out bench with no accounts and no keys: a local fleet Worker (in-memory D1) in front of a local fleetd.
// The pods are plain processes on this machine, so this measures fleet's own overhead and fan-out, not any cloud's boot time.
// Usage: N=12 C=6 TASK_SECONDS=2 bun scripts/bench-local.mjs
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { createKey } from '../src/store.js';
import { fakeD1 } from '../test/d1.js';

const token = 'local-bench-token-0123456789';
const fleetdPort = 18000 + Math.floor(Math.random() * 1000);
const fleetd = Bun.spawn(['bun', 'fleetd/fleetd.mjs'], { env: { ...process.env, FLEETD_TOKEN: token, PORT: String(fleetdPort), HOST: '127.0.0.1', FLEETD_MAX_PODS: '50' }, stdout: 'ignore', stderr: 'ignore' });
const DB = fakeD1(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const env = { DB, SESSION_SECRET: 'local-bench', PROVIDER_KEYS_SECRET: 'local-bench-provider-keys-secret-0123456789', PUBLIC_ORIGIN: 'http://localhost' };
const server = Bun.serve({ port: 0, fetch: (r) => worker.fetch(r, env) });
const { key } = await createKey(env, 'bench', 'local');
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${fleetdPort}/health`)).ok) break; } catch {} await Bun.sleep(100); }
const bench = Bun.spawn(['bun', 'scripts/bench-fanout.mjs', `http://localhost:${server.port}`], {
  env: { ...process.env, FLEET_KEY: key, PROVIDER: 'fleetpod', PROVIDER_KEY: `${token}@http://127.0.0.1:${fleetdPort}` },
  stdout: 'inherit', stderr: 'inherit',
});
const code = await bench.exited;
fleetd.kill();
server.stop(true);
process.exit(code);
