// PaperPod and Railway Sandboxes, added 2026-11-15 as the two no-card, public-link providers on host.flisk.si/rating that fleet
// did not have. Fake replies are shaped like PaperPod's /docs schema and Railway's SDK source; neither has met a real account.
import { describe, expect, test } from 'bun:test';
import paperpod, { readExec } from '../src/providers/paperpod.js';
import railway, { PUBLIC_PORTS, unpackRailway } from '../src/providers/railway.js';

function fakeFetch(answers) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined });
    const a = answers.shift();
    if (!a) throw new Error(`unexpected call to ${url}`);
    return new Response(JSON.stringify(a.body ?? null), { status: a.status ?? 200 });
  };
  return { calls, fetchImpl, wait: async () => {} };
}
const size = { cpu: 2, ram: 4 };

describe('paperpod', () => {
  test('no card, flat price for small pods only, untested with a help link', () => {
    expect(paperpod.facts.card).toBe(false);
    expect(paperpod.price(size)).toBe(0.36);
    expect(paperpod.price({ cpu: 4, ram: 8 })).toBeNull();
    expect(paperpod.working).toBeUndefined();
    expect(paperpod.help).toContain('issues/4');
  });

  test('create makes its own session id and starts the sandbox with one command', async () => {
    const f = fakeFetch([{ body: { status: 'ok', result: { stdout: '', stderr: '', exitCode: 0 } } }]);
    const { id } = await paperpod.create('pp_sess_x', size, f);
    expect(id).toMatch(/^fleet-[0-9a-f]{20}$/);
    expect(f.calls[0]).toMatchObject({ url: 'https://paperpod.dev/execute', method: 'POST', headers: { authorization: 'Bearer pp_sess_x' } });
    expect(f.calls[0].body).toMatchObject({ language: 'shell', sessionId: id });
  });

  test('run sends a shell command in the session and reads the result', async () => {
    const f = fakeFetch([{ body: { status: 'ok', result: { stdout: '4\n', stderr: '', exitCode: 0 } } }]);
    expect(await paperpod.run('k', 'fleet-abc', 'echo 4', f)).toEqual({ stdout: '4\n', stderr: '', exitCode: 0 });
    expect(f.calls[0].body).toMatchObject({ code: 'echo 4', language: 'shell', sessionId: 'fleet-abc' });
    expect(readExec({ stdout: 'a', exit_code: 2 })).toEqual({ stdout: 'a', stderr: '', exitCode: 2 });
  });

  test('a port becomes a paperpod.work link; stop never throws', async () => {
    const f = fakeFetch([{ body: { url: 'https://8080-fleet-abc-p8080_v1.paperpod.work', wsUrl: 'wss://x', exposedAt: 1 } }]);
    expect(await paperpod.publicUrl('k', 'fleet-abc', 8080, f)).toEqual({ url: 'https://8080-fleet-abc-p8080_v1.paperpod.work', wakesOnVisit: false, expiresAt: null });
    expect(f.calls[0]).toMatchObject({ url: 'https://paperpod.dev/expose', body: { port: 8080, sessionId: 'fleet-abc' } });
    await paperpod.stop('k', 'fleet-abc', fakeFetch([{ status: 500, body: { error: 'gone' } }]));
  });
});

describe('railway', () => {
  test('no card trial, priced per vCPU and GB in use', () => {
    expect(railway.facts.card).toBe(false);
    expect(railway.price(size)).toBe(0.417);
    expect(railway.price({ cpu: 64, ram: 4 })).toBeNull();
    expect(railway.help).toContain('issues/4');
  });

  test('create finds the environment from the project token, waits for RUNNING, and opens ports only for a public pod', async () => {
    const f = fakeFetch([
      { body: { data: { projectToken: { projectId: 'p1', environmentId: 'env1' } } } },
      { body: { data: { sandboxCreate: { id: 'sb1', status: 'CREATING' } } } },
      { body: { data: { sandbox: { id: 'sb1', status: 'RUNNING' } } } },
    ]);
    const { id } = await railway.create('tok', { ...size, public: true }, f);
    expect(id).toBe('env1~sb1');
    expect(f.calls[0]).toMatchObject({ url: 'https://backboard.railway.com/graphql/v2', headers: { 'project-access-token': 'tok' } });
    expect(f.calls[1].body.variables.input).toMatchObject({ environmentId: 'env1', resources: { cpu: 2, memoryGB: 4 }, publicDomains: PUBLIC_PORTS.map((port) => ({ port })) });

    const g = fakeFetch([{ body: { data: { projectToken: { environmentId: 'env1' } } } }, { body: { data: { sandboxCreate: { id: 'sb2', status: 'RUNNING' } } } }]);
    await railway.create('tok', size, g);
    expect(g.calls[1].body.variables.input.publicDomains).toBeUndefined();
  });

  test('a failed sandbox and a GraphQL error both throw with the reason', async () => {
    await expect(railway.create('tok', size, fakeFetch([{ body: { data: { projectToken: { environmentId: 'e' } } } }, { body: { data: { sandboxCreate: { id: 's', status: 'FAILED' } } } }]))).rejects.toThrow('failed');
    await expect(railway.create('tok', size, fakeFetch([{ body: { errors: [{ message: 'Not Authorized' }] } }]))).rejects.toThrow('Railway: Not Authorized');
  });

  test('run is sandboxExec; a 10 s timeout reads as exit 124', async () => {
    const f = fakeFetch([{ body: { data: { sandboxExec: { exitCode: 0, stdout: 'hi\n', stderr: '', truncated: false, timedOut: false } } } }]);
    expect(await railway.run('tok', 'env1~sb1', 'echo hi', f)).toEqual({ stdout: 'hi\n', stderr: '', exitCode: 0 });
    expect(f.calls[0].body.variables).toEqual({ e: 'env1', id: 'sb1', c: 'echo hi', t: 10 });
    const t = fakeFetch([{ body: { data: { sandboxExec: { exitCode: -1, stdout: '', stderr: '', timedOut: true } } } }]);
    expect((await railway.run('tok', 'env1~sb1', 'sleep 60', t)).exitCode).toBe(124);
  });

  test('a public link is the domain Railway made for that port; other ports are refused', async () => {
    const domains = { data: { sandbox: { domains: [{ port: 8080, domain: 'app-x.up.railway.app' }] } } };
    expect(await railway.publicUrl('tok', 'env1~sb1', 8080, fakeFetch([{ body: domains }]))).toEqual({ url: 'https://app-x.up.railway.app', wakesOnVisit: false, expiresAt: null });
    await expect(railway.publicUrl('tok', 'env1~sb1', 5173, fakeFetch([{ body: domains }]))).rejects.toThrow('3000, 8000, 8080');
  });

  test('stop destroys the sandbox; a bad id is refused', async () => {
    const f = fakeFetch([{ body: { data: { sandboxDestroy: { id: 'sb1', status: 'DESTROYING' } } } }]);
    await railway.stop('tok', 'env1~sb1', f);
    expect(f.calls[0].body.variables).toEqual({ id: 'sb1', e: 'env1' });
    expect(() => unpackRailway('nope')).toThrow();
  });
});
