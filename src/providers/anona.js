// Anona Compute (anonalabs.com). E2B-compatible gateway: https://api.compute.anonalabs.com, E2B_DOMAIN=compute.anonalabs.com
// (docs.anonalabs.com/compute/overview). Same wire protocol as E2B, so this reuses the E2B adapter. Picked by ICE score, see docs/ice-providers.md.
import { e2bLike } from './e2b.js';

const HOUR_2CPU_4GIB = 0.284; // orble.tech/sandboxes, 2026-11-15; Anona says preview pricing is not charged

export default e2bLike('compute.anonalabs.com', {
  label: 'Anona Compute',
  keyHeader: 'X-Anona-Key',
  working: undefined, // no real run yet
  help: 'https://github.com/flisk-sh/fleet/issues/4',
  priceSource: 'https://anonalabs.com',
  note: 'E2B-compatible gateway; sandboxes pause when idle and resume. Untested: needs a real key.',
  price: (size) => (size.cpu > 8 ? null : Math.round(((size.cpu + size.ram / 2) / 4) * HOUR_2CPU_4GIB * 1000) / 1000),
  facts: {
    blurb: 'Sandboxes that run agents for days, pause when idle and resume where they left off. E2B-compatible.',
    regions: [],
    billing: 'active vCPU time and resident memory',
    credit: 'Preview pricing is not charged (per vendor docs)',
    card: null,
    minimum: 0,
    maxCpu: 8,
    maxRam: 8,
    session: null,
    concurrent: null,
    startsPerDay: null,
    badges: ['E2B-compatible', 'Preview'],
    source: 'https://docs.anonalabs.com/compute/overview',
  },
});
