import { expect, test } from 'bun:test';
import { handle } from '../src/index.js';

test('HEAD works like GET without a body', async () => {
  for (const path of ['/', '/docs']) {
    const g = await handle(new Request(`https://fleet.test${path}`), {});
    const h = await handle(new Request(`https://fleet.test${path}`, { method: 'HEAD' }), {});
    expect(h.status).toBe(g.status);
    expect(await h.text()).toBe('');
  }
});

test('the CSP allows the flisk.si org bar icons in img-src', async () => {
  for (const path of ['/', '/docs']) {
    const res = await handle(new Request(`https://fleet.test${path}`), {});
    const csp = res.headers.get('content-security-policy');
    expect(csp).toMatch(/img-src [^;]*https:\/\/flisk\.si/);
  }
});

test('every shell loads Flisk Analytics in <head>, and the CSP allows its script and beacon', async () => {
  for (const path of ['/', '/docs', '/podlytics']) {
    const res = await handle(new Request(`https://fleet.test${path}`), {});
    const html = await res.text();
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    expect(head).toContain('<script defer data-domain="fleet.flisk.si" src="https://flisk.sh/a.js"></script>');
    const csp = res.headers.get('content-security-policy');
    expect(csp).toMatch(/script-src [^;]*https:\/\/flisk\.sh/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/analytics\.flisk\.si/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/flisk\.sh/);
  }
});

test('the pod API answers browser calls from practice.flisk.si and from no other site', async () => {
  const pre = await handle(new Request('https://fleet.test/v1/pods', { method: 'OPTIONS', headers: { origin: 'https://practice.flisk.si', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type,x-e2b-key' } }), {});
  expect(pre.status).toBe(204);
  expect(pre.headers.get('access-control-allow-origin')).toBe('https://practice.flisk.si');
  expect(pre.headers.get('access-control-allow-headers')).toContain('x-e2b-key');
  const post = await handle(new Request('https://fleet.test/v1/pods', { method: 'POST', headers: { origin: 'https://practice.flisk.si' }, body: '{}' }), {});
  expect(post.status).toBe(401);
  expect(post.headers.get('access-control-allow-origin')).toBe('https://practice.flisk.si');
  const other = await handle(new Request('https://fleet.test/v1/pods', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), {});
  expect(other.headers.get('access-control-allow-origin')).toBeNull();
  const cabinet = await handle(new Request('https://fleet.test/console', { headers: { origin: 'https://practice.flisk.si' } }), {});
  expect(cabinet.headers.get('access-control-allow-origin')).toBeNull();
});
