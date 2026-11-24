// The home hero's free-key button is the predicted next action: one data-next-cta, a spinning rainbow border.
import { describe, expect, test } from 'bun:test';
import { homePage, CSS } from '../src/page.js';

for (const lang of ['en', 'nl']) {
  describe(`next-cta on the ${lang} home page`, () => {
    const html = homePage({ origin: 'https://fleet.flisk.si', prices: [], size: 'small', lang });
    test('exactly one data-next-cta, and it carries class next-cta', () => {
      expect(html.match(/data-next-cta/g)).toHaveLength(1);
      const tag = /<a\b[^>]*data-next-cta[^>]*>/.exec(html)[0];
      expect(/class="([^"]*)"/.exec(tag)[1].split(/\s+/)).toContain('next-cta');
    });
    test('it is the first link after the first h1', () => {
      const after = html.slice(html.indexOf('</h1>'));
      const firstA = /<a\b[^>]*>/.exec(after)[0];
      expect(firstA).toContain('data-next-cta');
      expect(firstA).toContain('/auth/start');
    });
    test('the css has .next-cta with an animation and a reduced-motion rule', () => {
      expect(CSS).toMatch(/\.next-cta\b[^{]*\{[^}]*animation:/);
      expect(CSS).toContain('@property --next-cta-angle');
      expect(CSS).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^@]*\.next-cta[^{]*\{[^}]*animation:none/);
    });
  });
}
