import { expect, test } from 'bun:test';
import { handle } from '../src/index.js';
import { fromAcceptLanguage, pickLang } from '../src/i18n.js';
import { STR } from '../src/strings.js';

const get = (path, headers = {}) => handle(new Request(`https://fleet.test${path}`, { headers }), {});

test('Accept-Language: Dutch in any form picks nl, the highest q wins, everything else is en', () => {
  expect(fromAcceptLanguage('nl')).toBe('nl');
  expect(fromAcceptLanguage('nl-NL,nl;q=0.9,en;q=0.8')).toBe('nl');
  expect(fromAcceptLanguage('nl-BE')).toBe('nl');
  expect(fromAcceptLanguage('en-US,en;q=0.9,nl;q=0.5')).toBe('en');
  expect(fromAcceptLanguage('de,nl;q=0.6')).toBe('nl');
  expect(fromAcceptLanguage('fr-FR,de;q=0.8')).toBe('en');
  expect(fromAcceptLanguage('nl;q=0')).toBe('en');
  expect(fromAcceptLanguage('')).toBe('en');
  expect(fromAcceptLanguage(null)).toBe('en');
});

test('?lang= beats the cookie, the cookie beats Accept-Language', () => {
  const r = (url, h) => new Request(`https://fleet.test${url}`, { headers: h });
  expect(pickLang(r('/?lang=en', { 'accept-language': 'nl', cookie: 'fleet_lang=nl' }))).toBe('en');
  expect(pickLang(r('/', { 'accept-language': 'nl', cookie: 'fleet_lang=en' }))).toBe('en');
  expect(pickLang(r('/', { 'accept-language': 'nl' }))).toBe('nl');
  expect(pickLang(r('/?lang=xx', { 'accept-language': 'nl' }))).toBe('nl');
});

test('a Dutch browser gets the Dutch home page at /, an English one gets English', async () => {
  const nl = await get('/', { 'accept-language': 'nl-NL,nl;q=0.9' });
  const html = await nl.text();
  expect(html).toContain('<html lang="nl">');
  expect(html).toContain('Eén sleutel.');
  expect(html).toContain('Goedkoopste eerst');
  expect(html).toContain('rel="canonical" href="https://fleet.flisk.si/nl"');
  expect(nl.headers.get('vary')).toMatch(/Accept-Language/i);
  expect(nl.headers.get('content-language')).toBe('nl');
  const en = await (await get('/', { 'accept-language': 'en-US' })).text();
  expect(en).toContain('<html lang="en">');
  expect(en).toContain('One key.');
  expect(en).not.toContain('Eén sleutel');
});

test('/nl is always Dutch and remembers it; /?lang=en switches back and remembers that', async () => {
  const nl = await get('/nl', { 'accept-language': 'en' });
  expect(await nl.text()).toContain('Eén sleutel.');
  expect(nl.headers.get('set-cookie')).toContain('fleet_lang=nl');
  const back = await get('/?lang=en', { 'accept-language': 'nl' });
  expect(await back.text()).toContain('One key.');
  expect(back.headers.get('set-cookie')).toContain('fleet_lang=en');
  const kept = await get('/', { 'accept-language': 'nl', cookie: 'fleet_lang=en' });
  expect(await kept.text()).toContain('One key.');
});

test('both home pages link each other with hreflang and the sitemap lists /nl', async () => {
  for (const path of ['/', '/nl']) {
    const html = await (await get(path)).text();
    expect(html).toContain('hreflang="en" href="https://fleet.flisk.si/"');
    expect(html).toContain('hreflang="nl" href="https://fleet.flisk.si/nl"');
    expect(html).toContain('hreflang="x-default"');
  }
  expect(await (await get('/sitemap.xml')).text()).toContain('https://fleet.flisk.si/nl');
});

test('other pages stay English whatever the browser asks for', async () => {
  const docs = await (await get('/docs', { 'accept-language': 'nl' })).text();
  expect(docs).toContain('<html lang="en">');
});

test('every string exists in both languages with the same type', () => {
  expect(Object.keys(STR.nl).sort()).toEqual(Object.keys(STR.en).sort());
  for (const k of Object.keys(STR.en)) expect(typeof STR.nl[k]).toBe(typeof STR.en[k]);
  expect(Object.keys(STR.nl.states).sort()).toEqual(Object.keys(STR.en.states).sort());
});
