// Make the DigitalOcean snapshot that lets pods start fast: Ubuntu with Node and fleetd already installed.
// Run once with your own key; it costs a few cents (a small droplet for a few minutes, then a snapshot at DigitalOcean's storage price).
// Then use "<api token>@<snapshot id>" as the DigitalOcean key in fleet. The droplet used to build it is deleted at the end, even on failure.
// Usage: DO_TOKEN=dop_v1_... bun scripts/do-snapshot.mjs
import { IMAGE, REGION, snapshotUserData } from '../src/providers/digitalocean.js';

const { DO_TOKEN } = process.env;
if (!DO_TOKEN) throw new Error('set DO_TOKEN to your DigitalOcean API token');
const API = 'https://api.digitalocean.com/v2';
const api = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { authorization: `Bearer ${DO_TOKEN}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  if (r.status === 204) return {};
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${data.message || ''}`);
  return data;
};
const until = async (what, fn, tries = 60, ms = 5000) => {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, ms));
  }
  throw new Error(`timed out waiting for ${what}`);
};

const made = await api('POST', '/droplets', { name: 'fleet-snapshot-build', region: REGION, size: 's-1vcpu-1gb', image: IMAGE, user_data: snapshotUserData(), tags: ['fleet-build'] });
const id = made.droplet.id;
try {
  console.log(`droplet ${id} installing Node and fleetd, it powers itself off when done...`);
  await until('the droplet to power off', async () => (await api('GET', `/droplets/${id}`)).droplet.status === 'off', 90);
  const name = `fleet-pod-${new Date().toISOString().slice(0, 10)}`;
  const act = (await api('POST', `/droplets/${id}/actions`, { type: 'snapshot', name })).action;
  await until('the snapshot', async () => (await api('GET', `/actions/${act.id}`)).action.status === 'completed', 120);
  const snap = (await api('GET', `/droplets/${id}/snapshots`)).snapshots.find((s) => s.name === name);
  if (!snap) throw new Error('snapshot finished but was not listed');
  console.log(`\nSnapshot ${snap.id} (${name}). In fleet, set the DigitalOcean key to:\n  <your api token>@${snap.id}`);
} finally {
  await api('DELETE', `/droplets/${id}`).catch((e) => console.error('could not delete the build droplet, delete it by hand:', id, e.message));
}
