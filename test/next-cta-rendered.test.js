// The GEL next-cta guard reads bench/next-cta-rendered.json; it must match what homePage() renders now.
import { expect, test } from 'bun:test';
import { render, OUT } from '../scripts/render-next-cta.mjs';

test('bench/next-cta-rendered.json is up to date (run: bun scripts/render-next-cta.mjs)', async () => {
  const file = Bun.file(new URL(`../${OUT}`, import.meta.url));
  expect(await file.exists()).toBe(true);
  expect(await file.text()).toBe(render());
});
test('the rendered file holds en and nl, each with one data-next-cta', async () => {
  const { entries } = JSON.parse(render());
  expect(entries).toHaveLength(2);
  for (const e of entries) expect(e.html.match(/data-next-cta/g)).toHaveLength(1);
});
