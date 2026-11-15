// Railway Sandboxes. Docs: https://docs.railway.com/sandboxes · pricing: https://railway.com/pricing
// No card on the trial ($5 credit for 30 days). Everything is one GraphQL endpoint; the calls below were read from the
// railway@3.17.0 TypeScript SDK source (sandbox/engine.ts, generated/graphql.ts), since the docs only describe the SDK.
// The key is a PROJECT token (project settings > Tokens); its environment is looked up with `projectToken`.
// Untested: written from the SDK on 2026-11-15, no real account yet.
// Limits to know: a command over plain HTTPS runs at most 10 s (longer work: `nohup ... &` and poll), and public ports
// must be chosen when the sandbox starts, so a public pod opens 3000, 8000 and 8080.
import { call, sleep } from './http.js';

const API = 'https://backboard.railway.com/graphql/v2';
const PER_UNIT_HOUR = 50 / 720; // $50 per vCPU-month and $50 per GB-month, billed per second on use
export const PUBLIC_PORTS = [3000, 8000, 8080];

export async function gql(fetchImpl, key, query, variables = {}) {
  const r = await call(fetchImpl, API, { method: 'POST', headers: { 'project-access-token': key }, body: { query, variables } });
  if (r?.errors?.length) throw new Error(`Railway: ${String(r.errors[0]?.message || 'error').slice(0, 200)}`);
  return r?.data ?? {};
}

// fleet's id is "<environmentId>~<sandboxId>": every sandbox call needs both.
const pack = (env, id) => `${env}~${id}`;
export function unpackRailway(id) {
  const [env, sid] = String(id).split('~');
  if (!env || !sid) throw new Error('not a Railway pod id');
  return { env, sid };
}

export default {
  label: 'Railway Sandboxes',
  keyHeader: 'X-Railway-Key',
  help: 'https://github.com/flisk-sh/fleet/issues/4',
  untestedNote: 'Written from Railway\'s TypeScript SDK on 2026-11-15. It waits for its first run on a real account.',
  priceSource: 'https://docs.railway.com/sandboxes',
  note: 'No card on the trial ($5 for 30 days). Commands run at most 10 s each; public pods open ports 3000, 8000 and 8080.',
  price: (size) => (size.cpu > 32 || size.ram > 32 ? null : Math.round((size.cpu + size.ram) * PER_UNIT_HOUR * 1000) / 1000),
  facts: {
    blurb: 'Sandboxes on Railway, billed per second for the CPU and memory in use, with public *.railway.app links.',
    regions: ['US', 'EU', 'Asia'],
    billing: 'per second of CPU and memory in use',
    credit: 'Trial: $5 for 30 days, no card',
    card: false,
    minimum: 0,
    maxCpu: 32,
    maxRam: 32,
    session: null,
    concurrent: 10, // trial / free plan, per environment
    startsPerDay: null,
    badges: ['No card trial', 'Public links', 'Per-second billing'],
    source: 'https://docs.railway.com/sandboxes',
    signup: 'https://railway.com',
    keyPage: 'https://railway.com/dashboard',
    fields: [{ id: 'key', label: 'Project token', secret: true }],
  },

  async create(key, size, { fetchImpl = fetch, wait = sleep } = {}) {
    const env = (await gql(fetchImpl, key, 'query { projectToken { projectId environmentId } }')).projectToken?.environmentId;
    if (!env) throw new Error('Railway: this token names no environment (use a project token)');
    const input = { environmentId: env, resources: { cpu: size.cpu, memoryGB: size.ram }, idleTimeoutMinutes: 5 };
    if (size.public) Object.assign(input, { networkIsolation: 'PRIVATE', publicDomains: PUBLIC_PORTS.map((port) => ({ port })) });
    let sb = (await gql(fetchImpl, key, 'mutation($input: SandboxCreateInput!) { sandboxCreate(input: $input) { id status } }', { input })).sandboxCreate;
    if (!sb?.id) throw new Error('Railway returned no sandbox id');
    for (let i = 0; sb.status === 'CREATING' && i < 60; i++) {
      await wait(2000);
      sb = (await gql(fetchImpl, key, 'query($e: String!, $id: String!) { sandbox(environmentId: $e, id: $id) { id status } }', { e: env, id: sb.id })).sandbox || sb;
    }
    if (sb.status !== 'RUNNING') throw new Error(`Railway sandbox is ${String(sb.status || 'unknown').toLowerCase()}`);
    return { id: pack(env, sb.id) };
  },

  async run(key, id, command, { fetchImpl = fetch } = {}) {
    const { env, sid } = unpackRailway(id);
    const r = (await gql(fetchImpl, key, 'mutation($e: String!, $id: String!, $c: String!, $t: Int) { sandboxExec(environmentId: $e, id: $id, command: $c, timeoutSec: $t) { exitCode stdout stderr truncated timedOut } }', { e: env, id: sid, c: command, t: 10 })).sandboxExec || {};
    return { stdout: r.stdout ?? '', stderr: (r.stderr ?? '') + (r.timedOut ? '\n[Railway stopped the command after 10 s]' : ''), exitCode: r.timedOut ? 124 : r.exitCode ?? null };
  },

  async publicUrl(key, id, port, { fetchImpl = fetch, startup = '' } = {}) {
    const { env, sid } = unpackRailway(id);
    if (startup) await this.run(key, id, `nohup sh -c '${startup.replace(/'/g, `'\\''`)}' >/tmp/startup.log 2>&1 &`, { fetchImpl });
    const sb = (await gql(fetchImpl, key, 'query($e: String!, $id: String!) { sandbox(environmentId: $e, id: $id) { domains { port domain } } }', { e: env, id: sid })).sandbox;
    const d = (sb?.domains || []).find((x) => x.port === port);
    if (!d?.domain) throw new Error(`Railway opens ports only when a sandbox starts: start it with public: true and use ${PUBLIC_PORTS.join(', ')}`);
    return { url: d.domain.startsWith('http') ? d.domain : `https://${d.domain}`, wakesOnVisit: false, expiresAt: null };
  },

  async stop(key, id, { fetchImpl = fetch } = {}) {
    const { env, sid } = unpackRailway(id);
    await gql(fetchImpl, key, 'mutation($id: String!, $e: String!) { sandboxDestroy(id: $id, environmentId: $e) { id status } }', { id: sid, e: env });
  },
};
