// DigitalOcean Droplets (digitalocean.com). API: https://docs.digitalocean.com/reference/api/ · pricing: https://www.digitalocean.com/pricing/droplets
// A droplet has no command API, so each pod is ONE small VM that starts fleetd (fleetd/fleetd.mjs, the same pod host as the
// "Fleet pod" provider) from cloud-init, and fleet talks to fleetd on the droplet's public IP, port 80, with a per-pod token.
// Because the pod is a whole VM it is isolated from other pods and from other people, unlike a fleetd shared by many pods.
// Limits to know: the link to fleetd is plain HTTP (the token is random per pod and the VM is deleted on stop), a droplet
// takes about a minute to boot, and a stopped pod is DELETED, so nothing is kept.
// Faster start: the credential may carry a snapshot id, "<api token>@<snapshot id>", made once with scripts/do-snapshot.mjs.
// A droplet from that snapshot already has Node and fleetd, so cloud-init only checks the hash and starts it (no downloads).
// Untested: written from the public API docs on 2026-11-17, no real account yet (a new account needs a card).
import { call, sleep } from './http.js';

const API = 'https://api.digitalocean.com/v2';
export const REGION = 'fra1';
export const IMAGE = 'ubuntu-24-04-x64';
export const NODE_URL = 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-linux-x64.tar.gz';
export const FLEETD_URL = 'https://raw.githubusercontent.com/flisk-sh/fleet/main/fleetd/fleetd.mjs';
// Pinned: cloud-init refuses to start a fleetd whose bytes differ. test/digitalocean.test.js checks this equals fleetd/fleetd.mjs.
export const FLEETD_SHA256 = '13f7286407a259813c420e8572a81e4acf49050da0efceeba16355e2b0276a5f';

// Basic droplets (shared CPU). Monthly price / 672 h, the 4-week month DigitalOcean caps hourly billing at.
const SIZES = [
  { slug: 's-1vcpu-1gb', cpu: 1, ram: 1, month: 6 },
  { slug: 's-1vcpu-2gb', cpu: 1, ram: 2, month: 12 },
  { slug: 's-2vcpu-2gb', cpu: 2, ram: 2, month: 18 },
  { slug: 's-2vcpu-4gb', cpu: 2, ram: 4, month: 24 },
  { slug: 's-4vcpu-8gb', cpu: 4, ram: 8, month: 48 },
];
export const sizeFor = (size) => SIZES.find((s) => s.cpu >= size.cpu && s.ram >= size.ram) || null;

const auth = (key) => ({ authorization: `Bearer ${key}` });
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');

// "<api token>" boots from a stock Ubuntu image and downloads Node and fleetd; "<api token>@<snapshot id>" boots from a snapshot
// that already holds them. Droplet snapshot ids are plain digits.
export function parseKey(key) {
  const k = String(key);
  const i = k.indexOf('@');
  if (i < 0) return { token: k, snapshot: null };
  const snapshot = k.slice(i + 1);
  if (i < 1 || !/^\d+$/.test(snapshot)) throw new Error('DigitalOcean credential must be "<api token>" or "<api token>@<snapshot id>" (digits only)');
  return { token: k.slice(0, i), snapshot: Number(snapshot) };
}

// The install half: what a snapshot must already hold. Shared by cloud-init and scripts/do-snapshot.mjs.
export const installLines = () => [
  `curl -fsSL ${NODE_URL} | tar -xz -C /usr/local --strip-components=1`,
  `curl -fsSL ${FLEETD_URL} -o /opt/fleetd.mjs`,
];
const verifyLine = `echo "${FLEETD_SHA256}  /opt/fleetd.mjs" | sha256sum -c -`;

export function userData(token, { baked = false } = {}) {
  return [
    '#!/bin/bash',
    'set -e',
    ...(baked ? [] : installLines()),
    verifyLine,
    `FLEETD_TOKEN=${token} FLEETD_MAX_PODS=1 PORT=80 HOST=0.0.0.0 setsid nohup /usr/local/bin/node /opt/fleetd.mjs > /var/log/fleetd.log 2>&1 &`,
    '',
  ].join('\n');
}
export const snapshotUserData = () => ['#!/bin/bash', 'set -e', ...installLines(), verifyLine, 'poweroff', ''].join('\n');

// fleet's id is "<droplet id>~<ip>~<token>~<pod id in fleetd>": fleet stores nothing, so run() reads everything from it.
const pack = (...p) => p.join('~');
export function unpackDroplet(id) {
  const [droplet, ip, token, pod] = String(id).split('~');
  if (!droplet || !ip || !token || !pod) throw new Error('not a DigitalOcean pod id');
  return { droplet, ip, token, pod };
}
const fleetd = (ip, token) => ({ base: `http://${ip}`, headers: { authorization: `Bearer ${token}` } });

export default {
  label: 'DigitalOcean',
  keyHeader: 'X-Digitalocean-Key',
  help: 'https://github.com/flisk-sh/fleet/issues/4',
  blocked: { kind: 'card', note: 'DigitalOcean asks for a card when you sign up, so we cannot test it for free.' },
  priceSource: 'https://www.digitalocean.com/pricing/droplets',
  note: 'One VM per pod, about a minute to start (faster from a snapshot: see scripts/do-snapshot.mjs). Sizes 1/1 up to 4/8 (vCPU/GB). Stopping deletes the droplet.',
  price: (size) => {
    const s = sizeFor(size);
    return s ? Math.round((s.month / 672) * 1000) / 1000 : null;
  },
  facts: {
    blurb: 'A whole virtual machine per pod, so pods are isolated from each other. Takes about a minute to start.',
    regions: ['EU'],
    billing: 'per second, 60 s minimum',
    credit: 'Card needed at sign-up',
    card: true,
    minimum: 0,
    maxCpu: 4,
    maxRam: 8,
    session: null,
    concurrent: null,
    startsPerDay: null,
    badges: ['Own VM per pod', 'Card needed', 'About 1 min to start'],
    source: 'https://www.digitalocean.com/pricing/droplets',
    signup: 'https://cloud.digitalocean.com/registrations/new',
    keyPage: 'https://cloud.digitalocean.com/account/api/tokens',
  },

  async create(key, size, { fetchImpl = fetch, wait = sleep } = {}) {
    const sz = sizeFor(size);
    if (!sz) throw new Error('size not offered: DigitalOcean pods are at most 4 vCPU and 8 GB');
    const { token: apiKey, snapshot } = parseKey(key);
    key = apiKey;
    const token = randomToken();
    const made = await call(fetchImpl, `${API}/droplets`, {
      method: 'POST',
      headers: auth(key),
      body: { name: `fleet-${token.slice(0, 8)}`, region: REGION, size: sz.slug, image: snapshot ?? IMAGE, user_data: userData(token, { baked: snapshot !== null }), tags: ['fleet'], monitoring: false },
    });
    const droplet = made?.droplet?.id;
    if (!droplet) throw new Error('DigitalOcean returned no droplet id');
    try {
      let ip = null;
      for (let i = 0; !ip && i < 12; i++) {
        await wait(5000);
        const d = (await call(fetchImpl, `${API}/droplets/${droplet}`, { headers: auth(key) }))?.droplet;
        if (d?.status === 'archive' || d?.status === 'off') throw new Error(`droplet is ${d.status}`);
        ip = d?.status === 'active' ? d.networks?.v4?.find((n) => n.type === 'public')?.ip_address || null : null;
      }
      if (!ip) throw new Error('the droplet did not get a public address in time');
      const { base, headers } = fleetd(ip, token);
      let up = false;
      for (let i = 0; !up && i < 24; i++) {
        try {
          up = Boolean((await call(fetchImpl, `${base}/health`, { headers }))?.ok);
        } catch {
          up = false;
        }
        if (!up) await wait(5000);
      }
      if (!up) throw new Error('the droplet started but fleetd did not answer in time');
      const pod = await call(fetchImpl, `${base}/pods`, { method: 'POST', headers, body: { ttl: size.ttl ?? 3600 } });
      if (!pod?.id) throw new Error('fleetd returned no pod id');
      return { id: pack(droplet, ip, token, pod.id) };
    } catch (e) {
      // Never leave a billing droplet behind after a failed start.
      await call(fetchImpl, `${API}/droplets/${droplet}`, { method: 'DELETE', headers: auth(key) }).catch(() => {});
      throw e;
    }
  },

  async run(key, id, command, { fetchImpl = fetch } = {}) {
    const { ip, token, pod } = unpackDroplet(id);
    const { base, headers } = fleetd(ip, token);
    const r = await call(fetchImpl, `${base}/pods/${encodeURIComponent(pod)}/exec`, { method: 'POST', headers, body: { command, timeout: 600 } });
    return { stdout: r?.stdout ?? '', stderr: r?.stderr ?? '', exitCode: r?.exitCode ?? null };
  },

  async stop(key, id, { fetchImpl = fetch } = {}) {
    const { droplet } = unpackDroplet(id);
    try {
      await call(fetchImpl, `${API}/droplets/${droplet}`, { method: 'DELETE', headers: auth(parseKey(key).token) });
    } catch (e) {
      if (e.status !== 404) throw e; // already gone counts as stopped
    }
  },
};
