// Renders the server-built home page (en, nl) to bench/next-cta-rendered.json for the GEL `next-cta` guard.
// The guard reads static HTML or a rendered measurement ({ entries: [{ page, html }] }); fleet's pages are strings
// built by src/page.js, so this file is the rendered form. `bun scripts/render-next-cta.mjs` rewrites it;
// test/next-cta-rendered.test.js fails when it is stale.
import { homePage } from '../src/page.js';

export const OUT = 'bench/next-cta-rendered.json';
export const render = () => JSON.stringify({
  entries: ['en', 'nl'].map((lang) => ({
    page: `/ (${lang})`,
    html: homePage({ origin: 'https://fleet.flisk.si', prices: [], size: 'small', lang }),
  })),
}, null, 2) + '\n';

if (import.meta.main) {
  await Bun.write(new URL(`../${OUT}`, import.meta.url), render());
  console.log(`wrote ${OUT}`);
}
