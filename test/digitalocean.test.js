// DigitalOcean adapter against fake replies shaped like the public API docs. No real account has run it yet.
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import digitalocean, { FLEETD_SHA256, sizeFor, unpackDroplet, userData } from '../src/providers/digitalocean.js';

function fakeFetch(answers) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    const a = answers.shift();
    if (!a) throw new Error(`unexpected call to ${url}`);
    if (a.throws) throw new Error(a.throws);
    return new Response(typeof a.body === 'string' ? a.body : JSON.stringify(a.body ?? null), { status: a.status ?? 200 });
  };
  return { calls, fetchImpl, wait: async () => {} };
}
const active = { droplet: { id: 42, status: 'active', networks: { v4: [{ type: 'private', ip_address: '10.0.0.2' }, { type: 'public', ip_address: '203.0.113.7' }] } } };

describe('digitalocean', () => {
  test('the pinned fleetd hash matches fleetd/fleetd.mjs', () => {
    expect(FLEETD_SHA256).toBe(createHash('sha256').update(readFileSync(new URL('../fleetd/fleetd.mjs', import.meta.url))).digest('hex'));
  });
  test('picks the smallest droplet that fits and prices it per hour', () => {
    expect(sizeFor({ cpu: 1, ram: 1 }).slug).toBe('s-1vcpu-1gb');
    expect(sizeFor({ cpu: 2, ram: 3 }).slug).toBe('s-2vcpu-4gb');
    expect(sizeFor({ cpu: 8, ram: 8 })).toBeNull();
    expect(digitalocean.price({ cpu: 1, ram: 1 })).toBe(0.009);
    expect(digitalocean.price({ cpu: 16, ram: 1 })).toBeNull();
  });
  test('cloud-init checks the hash before it starts fleetd', () => {
    const s = userData('tok');
    expect(s.indexOf('sha256sum -c')).toBeLessThan(s.indexOf('FLEETD_TOKEN=tok'));
    expect(s).toContain('PORT=80');
  });
  test('create, run, stop', async () => {
    const f = fakeFetch([
      { body: { droplet: { id: 42 } }, status: 202 },
      { body: { droplet: { id: 42, status: 'new', networks: { v4: [] } } } },
      { body: active },
      { throws: 'connection refused' },
      { body: { ok: true } },
      { body: { id: 'p1' } },
      { body: { stdout: 'hi\n', stderr: '', exitCode: 0 } },
      { body: null, status: 204 },
      { body: { id: 'not_found', message: 'gone' }, status: 404 },
    ]);
    const { id } = await digitalocean.create('dop_v1_x', { cpu: 1, ram: 1, ttl: 600 }, f);
    const sent = JSON.parse(f.calls[0].body);
    expect(f.calls[0].headers.authorization).toBe('Bearer dop_v1_x');
    expect(sent).toMatchObject({ size: 's-1vcpu-1gb', image: 'ubuntu-24-04-x64', tags: ['fleet'] });
    const u = unpackDroplet(id);
    expect(u).toMatchObject({ droplet: '42', ip: '203.0.113.7', pod: 'p1' });
    expect(f.calls.at(-1).url).toBe('http://203.0.113.7/pods');
    expect(await digitalocean.run('k', id, 'echo hi', f)).toEqual({ stdout: 'hi\n', stderr: '', exitCode: 0 });
    expect(f.calls.at(-1).url).toBe('http://203.0.113.7/pods/p1/exec');
    await digitalocean.stop('k', id, f);
    await digitalocean.stop('k', id, f); // already gone is fine
  });
  test('a failed start deletes the droplet', async () => {
    const f = fakeFetch([{ body: { droplet: { id: 7 } } }, { body: { droplet: { id: 7, status: 'off' } } }, { body: null, status: 204 }]);
    await expect(digitalocean.create('k', { cpu: 1, ram: 1 }, f)).rejects.toThrow(/off/);
    expect(f.calls.at(-1)).toMatchObject({ method: 'DELETE', url: 'https://api.digitalocean.com/v2/droplets/7' });
  });
  test('refuses a bad pod id', () => {
    expect(() => unpackDroplet('x')).toThrow(/not a DigitalOcean/);
  });
});
