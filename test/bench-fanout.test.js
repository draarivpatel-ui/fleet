import { expect, test } from 'bun:test';

// A fake fleet where a pod takes 150 ms to start and a task takes 100 ms: fan-out and warm pods must beat cold-serial.
test('bench-fanout prints a table where parallel modes beat cold-serial and nothing fails', async () => {
  let n = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      const json = (o, status = 200) => Response.json(o, { status });
      if (req.method === 'POST' && pathname === '/v1/pods') { await Bun.sleep(150); return json({ id: `p${++n}` }, 201); }
      if (req.method === 'POST' && pathname.endsWith('/run')) { await Bun.sleep(100); return json({ exitCode: 0, stdout: 'done\n' }); }
      if (req.method === 'DELETE') return json({ stopped: true });
      return json({}, 404);
    },
  });
  const proc = Bun.spawn(['bun', 'scripts/bench-fanout.mjs', `http://localhost:${server.port}`], {
    env: { ...process.env, FLEET_KEY: 'fleet_x', PROVIDER: 'demo', N: '8', C: '4', TASK_SECONDS: '0' },
    stdout: 'pipe', stderr: 'pipe',
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  server.stop(true);
  const row = (name) => out.split('\n').find((l) => l.startsWith(`| ${name} `)).split('|').map((c) => c.trim());
  expect(row('cold-serial')[7]).toBe('0/8');
  expect(row('cold-parallel')[7]).toBe('0/8');
  expect(row('warm-parallel')[7]).toBe('0/8');
  expect(parseFloat(row('cold-parallel')[3])).toBeGreaterThan(1.5);
  expect(parseFloat(row('warm-parallel')[3])).toBeGreaterThan(1.5);
}, 30000);
