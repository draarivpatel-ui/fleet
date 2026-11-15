// PaperPod (paperpod.dev). API schema: `curl https://paperpod.dev/docs` (JSON); human docs https://paperpod.dev/docs.
// No card: new accounts get $5 of credit. One flat-priced Linux container per session (python3, node, bun, git, ...).
// PaperPod has no create or delete call: a sandbox is made on the first call that names a new sessionId and ends with the
// session. So fleet's pod id IS the sessionId, made here, and create sends one small command to start the sandbox.
// Untested: written from the schema on 2026-11-15, no real account yet. The key is a session token (pp_sess_...) that
// PaperPod sends by a magic link to the account's email.
import { call } from './http.js';

const API = 'https://paperpod.dev';
const HOUR = 0.36; // $0.0001 per second of compute, flat (paperpod.dev/docs)
const auth = (key) => ({ authorization: `Bearer ${key}` });

const newSessionId = () => `fleet-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

// /execute answers { status, result: { stdout, stderr, exitCode } } per the schema; read a flat answer too.
export function readExec(r) {
  const x = r?.result && typeof r.result === 'object' ? r.result : r || {};
  return { stdout: x.stdout ?? '', stderr: x.stderr ?? '', exitCode: x.exitCode ?? x.exit_code ?? null };
}

export default {
  label: 'PaperPod',
  keyHeader: 'X-Paperpod-Key',
  help: 'https://github.com/flisk-sh/fleet/issues/4',
  untestedNote: 'Written from PaperPod\'s API schema on 2026-11-15. It waits for its first run on a real account.',
  priceSource: 'https://paperpod.dev/docs',
  note: 'One fixed container per session at a flat $0.36 an hour. No card: $5 free credit. Public links at <port>-<session>.paperpod.work.',
  // The container size is not published, so fleet offers it for small pods only.
  price: (size) => (size.cpu <= 2 && size.ram <= 4 ? HOUR : null),
  facts: {
    blurb: 'A Linux container per session with Python, Node, Bun and git, and a public link for any port. $5 free, no card.',
    regions: [],
    billing: 'per second of compute, flat',
    credit: '$5 free credit on sign-up, no card',
    card: false,
    minimum: 0,
    maxCpu: 2,
    maxRam: 4,
    session: null,
    concurrent: null,
    startsPerDay: null,
    badges: ['No card', 'Public links', '$5 free'],
    source: 'https://paperpod.dev/docs',
    signup: 'https://paperpod.dev',
    keyPage: 'https://paperpod.dev',
  },

  async create(key, _size, { fetchImpl = fetch } = {}) {
    const sessionId = newSessionId();
    const r = readExec(await call(fetchImpl, `${API}/execute`, { method: 'POST', headers: auth(key), body: { code: 'true', language: 'shell', sessionId, timeout: 30000 } }));
    if (r.exitCode !== 0 && r.exitCode !== null) throw new Error(`PaperPod could not start a sandbox (exit ${r.exitCode})`);
    return { id: sessionId };
  },

  async run(key, id, command, { fetchImpl = fetch } = {}) {
    return readExec(await call(fetchImpl, `${API}/execute`, { method: 'POST', headers: auth(key), body: { code: command, language: 'shell', sessionId: id, timeout: 600000 } }));
  },

  // POST /expose { port, sessionId } answers { url, wsUrl, exposedAt }. The server must already listen on 0.0.0.0.
  async publicUrl(key, id, port, { fetchImpl = fetch, startup = '' } = {}) {
    if (startup) await call(fetchImpl, `${API}/process/start`, { method: 'POST', headers: auth(key), body: { command: startup, sessionId: id } });
    const r = await call(fetchImpl, `${API}/expose`, { method: 'POST', headers: auth(key), body: { port, sessionId: id } });
    if (!r?.url) throw new Error('PaperPod returned no public URL');
    return { url: r.url, wakesOnVisit: false, expiresAt: null };
  },

  // There is no delete. Kill what the session still runs; the container goes when the session ends.
  async stop(key, id, { fetchImpl = fetch } = {}) {
    await call(fetchImpl, `${API}/execute`, { method: 'POST', headers: auth(key), body: { code: 'kill -9 -1 2>/dev/null; true', language: 'shell', sessionId: id, timeout: 10000 } }).catch(() => {});
  },
};
