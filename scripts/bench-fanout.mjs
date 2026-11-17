// Fan-out bench: the same N tasks run three ways through the fleet API, with wall time, per-task median/p95 and failures.
//   cold-serial    one pod per task, one task at a time (what a single thread does today)
//   cold-parallel  one pod per task, C at a time
//   warm-parallel  C pods started first (timed apart), tasks reuse them, C at a time
// A task is a shell command (default: sleep TASK_SECONDS). Replace it with a real agent step to bench an agent.
// Usage: FLEET_KEY=... PROVIDER=digitalocean PROVIDER_KEY=... N=12 C=6 TASK_SECONDS=20 bun scripts/bench-fanout.mjs [baseUrl]
// Pods are always stopped. Prints a markdown table; it claims nothing, read the numbers.
import { PROVIDERS } from '../src/providers/index.js';

const B = process.argv[2] || 'https://fleet.flisk.si';
const { FLEET_KEY, PROVIDER, PROVIDER_KEY, TASK } = process.env;
const N = Number(process.env.N || 12);
const C = Number(process.env.C || 6);
const SECS = Number(process.env.TASK_SECONDS || 10);
if (!FLEET_KEY || !PROVIDER) throw new Error('set FLEET_KEY and PROVIDER');
const command = TASK || `sleep ${SECS}; echo done`;
const H = { authorization: `Bearer ${FLEET_KEY}`, 'content-type': 'application/json', ...(PROVIDER_KEY && PROVIDERS[PROVIDER] ? { [PROVIDERS[PROVIDER].keyHeader]: PROVIDER_KEY } : {}) };

const api = async (method, path, body) => {
  const r = await fetch(B + path, { method, headers: H, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const start = async () => {
  const r = await api('POST', '/v1/pods', { provider: PROVIDER, cpu: 1, ram: 1 });
  if (r.status !== 201 || !r.data.id) throw new Error(`start failed: ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  return r.data.id;
};
const stop = (id) => api('DELETE', `/v1/pods/${encodeURIComponent(id)}`).catch(() => {});
const run = async (id) => {
  const r = await api('POST', `/v1/pods/${encodeURIComponent(id)}/run`, { command, timeout: SECS + 120 });
  if (r.status !== 200 || r.data.exitCode !== 0) throw new Error(`run failed: ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
};
const pool = async (items, limit, fn) => {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      const t = performance.now();
      try { await fn(items[k], k); out[k] = { ok: true, ms: performance.now() - t }; } catch (e) { out[k] = { ok: false, ms: performance.now() - t, error: String(e.message) }; }
    }
  }));
  return out;
};
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : 0; };
const tasks = Array.from({ length: N }, (_, i) => i);
const coldTask = async () => { const id = await start(); try { await run(id); } finally { await stop(id); } };

const modes = [];
const measure = async (name, limit, work, setupMs = 0) => {
  const t = performance.now();
  const res = await work(limit);
  const wall = performance.now() - t + setupMs;
  const ok = res.filter((r) => r.ok).map((r) => r.ms);
  modes.push({ name, wall, setupMs, ok: ok.length, fail: res.length - ok.length, med: pct(ok, 0.5), p95: pct(ok, 0.95), err: res.find((r) => !r.ok)?.error });
};

await measure('cold-serial', 1, (l) => pool(tasks, l, coldTask));
await measure('cold-parallel', C, (l) => pool(tasks, l, coldTask));
{
  const t0 = performance.now();
  const ids = [];
  const made = await pool(Array.from({ length: C }), C, async () => { ids.push(await start()); });
  const setup = performance.now() - t0;
  try {
    const free = [...ids];
    await measure('warm-parallel', C, (l) => pool(tasks, l, async () => { const id = free.pop(); try { await run(id); } finally { free.push(id); } }), setup);
  } finally { await Promise.all(ids.map(stop)); }
  if (made.some((m) => !m.ok)) console.error('warm pool: some pods failed to start', made.find((m) => !m.ok).error);
}

const s = (ms) => (ms / 1000).toFixed(1);
const base = modes[0].wall;
console.log(`\nFan-out bench: ${N} tasks of "${command}", ${C} at a time, provider ${PROVIDER}, ${new Date().toISOString().slice(0, 16)} UTC\n`);
console.log('| Mode | Wall s | vs cold-serial | Pool setup s | Task median s | Task p95 s | Failed |\n|---|---|---|---|---|---|---|');
for (const m of modes) console.log(`| ${m.name} | ${s(m.wall)} | ${(base / m.wall).toFixed(2)}x | ${m.setupMs ? s(m.setupMs) : '-'} | ${s(m.med)} | ${s(m.p95)} | ${m.fail}/${m.ok + m.fail} |`);
for (const m of modes) if (m.err) console.log(`\n${m.name} first error: ${m.err}`);
console.log('\nwarm-parallel wall includes pool setup. A run with failures is not a speed result.');
