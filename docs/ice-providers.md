# Which sandbox providers to add next (ICE)

Source: orble.tech/sandboxes, read 2026-11-15. The page lists about 700 rows; only the first 81 (agend to E2B) were read, so
the rest are not scored. ICE = Impact x Confidence x Ease, each 1-10, higher is better (Ease = how little work).
Impact: cheap per hour and a free credit that lets a user try fleet. Confidence: public API docs found and checked.
Ease: reuses an adapter we already have.

| Provider | Price/h (2 vCPU, 4 GiB) | I | C | E | ICE | Why |
|---|---|---|---|---|---|---|
| Anona Compute | $0.284 | 6 | 8 | 10 | 480 | E2B-compatible gateway, documented domain; one small file |
| Cathedral | $0.035 | 8 | 4 | 4 | 128 | cheapest hourly rate; own API (POST /v1/sandboxes, needs required_hardware, prepaid credit first) |
| Alibaba Cloud Agent Sandbox | $0.0714 | 7 | 2 | 6 | 84 | E2B SDK compatible, but needs an Alibaba cloud account |
| BoxFab, Anona-style clones | n/a | 3 | 3 | 8 | 72 | E2B-compatible, no hosted price |
| Cloudflare / Docker / Deno / AWS | $0.14-0.25 | 5 | 2 | 2 | 20 | big names, but account or SDK work |
| BrowserPod, APIHub, agent-exec | per request | 2 | 3 | 3 | 18 | not a pod by the hour |

Done: Anona. Next: Cathedral. Not run against a real account yet (marked untested, like the others before a real key).
