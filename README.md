# SolarSanity — Solar Quote Auditor

Paste a few numbers from your solar proposal and get a brutal, itemized audit in
seconds: fair-price check for your state, the hidden loan **dealer fee**, the
**expired 30% federal tax-credit** trap, inflated-production checks, and a
ready-to-send negotiation email. **Runs 100% in your browser** — nothing is
uploaded, no lead is sold.

One codebase → every platform (PWA). No backend, no paid APIs, zero cost to run.

## Why it exists

Homeowners spend $20–40k on solar and have no independent way to sanity-check a
quote. Free tools (EnergySage & co.) are lead-gen marketplaces that sell your
info; consultants are manual and pricey. SolarSanity is the private, self-serve
alternative — the distrust of lead-gen is the wedge.

## What it checks (2026-current)

- **Fair $/W** vs a state benchmark (US avg ~$2.60/W in 2026).
- **Hidden dealer fee** — `financed total − cash price`; low APRs bury 15–30%+ (CFPB-documented).
- **Expired §25D credit** — the 30% residential credit ended **Dec 31, 2025**; owned 2026 systems get $0 federal. Flags quotes whose savings still assume 30%.
- **Inflated production** vs realistic specific yield for the state.
- **Lease/PPA escalators** that balloon payments; you never own the system.
- Outputs a **fair-price target** and a copy-paste **negotiation email**.

## Structure

| File | Role |
|------|------|
| `audit.js` | Pure audit logic (unit-tested) |
| `benchmarks.js` | Per-state $/W + specific-yield benchmarks (one place to tune) |
| `app.js` | Form UI |
| `tests/` | 12 unit tests, zero deps (`node --test`) |
| `sw.js` / `manifest.webmanifest` | PWA |
| `server.mjs` | Zero-dep static server |

## Run / test

```bash
node server.mjs   # http://localhost:4601
node --test       # 12/12
```

## Deploy (zero cost)

Any static host with HTTPS (GitHub Pages / Cloudflare Pages free tier). No env, no secrets.

## Monetization (planned)

Free scan. **Pro** ($19–29 one-time): PDF proposal parsing, full printable report,
battery + utility-rate payback, saved history. Sell via Gumroad/Paddle.
Distribution: post free audits of quotes people share on r/solar & r/solarenergy.

## Disclaimer

Estimates for negotiation — not financial, tax, or legal advice. Benchmarks are
2026 approximations; verify current state/utility incentives yourself.
