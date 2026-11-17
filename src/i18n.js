// Languages for the public pages: English (the default) and Dutch.
// The home page and the page chrome (top bar, footer) are translated. The docs, pricing, demo, podlytics and the
// console stay English. The API, MCP tools and SKILL.md are never translated: agents read them.

export const LANGS = ['en', 'nl'];
export const LANG_COOKIE = 'fleet_lang';

const COOKIE_RE = new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(en|nl)(?:;|$)`);

// The best language in an Accept-Language header: highest q wins, nl-NL and nl-BE count as nl, anything else is en.
// A header that never mentions Dutch gives en, so a French or German browser keeps the English page.
export function fromAcceptLanguage(header) {
  let best = { lang: 'en', q: 0 };
  for (const part of String(header || '').split(',')) {
    const [tag, ...params] = part.trim().split(';');
    const primary = tag.trim().toLowerCase().split('-')[0];
    if (!LANGS.includes(primary)) continue;
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const q = qParam === undefined ? 1 : Number(qParam.slice(2));
    if (Number.isFinite(q) && q > best.q) best = { lang: primary, q };
  }
  return best.lang;
}

// The language for a page: ?lang= first (the switcher), then the cookie the switcher set, then the browser's language.
export function pickLang(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('lang');
  if (LANGS.includes(q)) return q;
  const cookie = (request.headers.get('cookie') || '').match(COOKIE_RE);
  if (cookie) return cookie[1];
  return fromAcceptLanguage(request.headers.get('accept-language'));
}

export const langCookie = (lang) => `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
