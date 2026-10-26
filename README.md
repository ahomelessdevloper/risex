# RiseLlama

Unofficial analytics dashboard for [RISEx](https://rise.trade), the fully onchain perp DEX on RISE chain, in the spirit of LighterLlama.

## Sections

- **Overview**: rolling 24h volume, open interest, live TVL, 7d/30d/all-time volume, daily volume by asset class, cumulative volume, OI and TVL history, asset-class mix and top markets.
- **Markets**: every live market with price, 24h change, volume, one-sided OI, OI-cap usage, funding (1h and APR) and max leverage. Sortable and filterable.
- **Funding**: OI-weighted funding APR, current funding per market, and 30 days of hourly funding history for any market.
- **Traders**: top 100 accounts by volume, fees or liquidations over 24h, 7d or 14d, with share of total exchange volume.
- **Liquidity**: spread and resting order-book depth within ±0.5/1/2% of mid for every market.
- **Airdrop**: calculator for your points' value at a given launch FDV and 20/25/30% airdrop supply, plus a FDV sensitivity table and a live countdown to the next weekly points drop. The total-points default is Ignite Season 1 drops so far (200K points a week).

The referral link at the top of the page lives in `src/lib/links.ts`.

## Data sources

| Data | Source |
| --- | --- |
| Markets, candles, funding, leaderboard, order books, points epoch | `https://api.rise.trade/v1` (public, no key) |
| Live TVL | USDC `balanceOf(CollateralManager)` via `https://rpc.risechain.com` |
| OI and TVL history | DefiLlama (`api.llama.fi`) |

RISEx's API has no CORS headers, so the Next.js server fetches the data. Each fetch is cached with `'use cache'` (`src/lib/risex.ts`) and served to the browser through `src/app/api/*`. Market data revalidates every 30s and the page polls every 60s.

Methodology notes:

- Open interest is one-sided: the API reports long and short summed, so it is halved (matching DefiLlama).
- Historical daily volume is close × base volume from each market's daily candles, which is the same method DefiLlama uses.
- On the leaderboard each fill counts for both maker and taker, so a trader's share is measured against twice the exchange volume.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm start
```

Built with Next.js 16 (App Router, Cache Components), Tailwind CSS 4 and Recharts.
