# 📊 Portfolio Tracker

A personal investment portfolio tracker built with **Next.js 16**, inspired by Zerodha Console. Tracks Indian stocks, US stocks, mutual funds, EPF, PPF, and commodities — all in one clean dashboard with live prices.

## ✨ Features

- **Live price updates** — Indian stocks & ETFs via Yahoo Finance, Mutual Fund NAV via AMFI/mfapi.in, SGB via gold spot price
- **Market status** — Real-time Indian (NSE) and US market open/closed indicators
- **Dark / Light theme** toggle
- **Segment tabs** — IND Stocks · US Stocks · Mutual Funds · EPF · PPF · Commodities
- **Cross-listed instruments** — Gold/Silver ETFs and SGBs shown in IND Stocks (Zerodha Kite); Platinum/Copper ETFs shown in US Stocks (Indmoney) — **zero duplication** in totals
- **Fractional US shares** — Full support for Indmoney's fractional quantities
- **USD → INR conversion** — Live exchange rate, toggle per-view in US Stocks tab
- **Historical graph** — Daily Invested vs Current Value snapshots (90-day rolling)
- **Portfolio allocation** — Segment pie chart + Commodities sub-breakdown
- **File-based data** — `data/instruments.json` as the source of truth (no database needed)

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Vanilla CSS (custom design system) |
| Charts | Recharts |
| Price data | Yahoo Finance (`yahoo-finance2`), AMFI mfapi.in |
| Data store | JSON files (`data/`) |
| Deployment | Vercel |

## 🚀 Getting Started

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/portfolio-tracker.git
cd portfolio-tracker
npm install
```

### 2. Set up environment

```bash
cp .env.example .env.local
# Edit .env.local and add your Gemini API key (optional — only needed for AI features)
```

### 3. Add your holdings

Create `data/instruments.json` using the schema below, or copy from `data/instruments.json.example`:

```json
[
  {
    "id": "unique-id",
    "ticker": "HDFCBANK",
    "name": "HDFC Bank",
    "type": "STOCK_IN",
    "category": "INDIAN_EQ",
    "commodityType": null,
    "quantity": 10,
    "avgBuyPrice": 1500,
    "buyDate": "2024-01-15",
    "investedAmount": 15000,
    "exchange": "NSE",
    "amfiCode": null,
    "currency": "INR",
    "notes": null,
    "broker": "Zerodha",
    "createdAt": "2024-01-15T00:00:00Z",
    "updatedAt": "2024-01-15T00:00:00Z"
  }
]
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

## 📁 Project Structure

```
portfolio-tracker/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main dashboard + tab shell
│   │   ├── data.ts           # Dummy/demo data (replace with real)
│   │   ├── components.tsx    # Shared UI components
│   │   ├── tabs.tsx          # Segment tab views
│   │   ├── globals.css       # Design system (dark + light themes)
│   │   └── api/
│   │       └── prices/       # Live price API route
│   ├── lib/
│   │   ├── db.ts             # File-based JSON data access
│   │   └── price-engine.ts   # Yahoo Finance + AMFI price fetcher
│   └── types/
│       └── index.ts          # TypeScript types
├── data/                     # gitignored — add your own instruments.json
├── scripts/                  # Data ingestion helpers
└── .env.example              # Copy to .env.local
```

## 🔒 Privacy

Your `data/instruments.json` (real holdings) is **gitignored** by default. Never commit your actual portfolio data to a public repo.

## 🌐 Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Set the `GEMINI_API_KEY` environment variable in the Vercel dashboard if using AI features.

> **Note:** Since real portfolio data lives in `data/instruments.json` (gitignored), you'll need to either upload it manually after deploy, or use Vercel's environment variables + a remote data store for a fully cloud-hosted setup.

## 📌 Instrument Types Supported

| Type | Category | Price Source |
|---|---|---|
| `STOCK_IN` | Indian Equities | Yahoo Finance (`.NS`) |
| `STOCK_US` | US Equities | Yahoo Finance |
| `MUTUAL_FUND` | Mutual Funds | AMFI via mfapi.in |
| `GOLD_ETF` | Commodities | Yahoo Finance (`.NS`) |
| `SILVER_ETF` | Commodities | Yahoo Finance (`.NS`) |
| `SGB` | Commodities | Yahoo Finance → gold spot fallback |
| `PLATINUM_ETF` | Commodities | Yahoo Finance (USD) |
| `COPPER_ETF` | Commodities | Yahoo Finance (USD) |
| `REIT` | REITs | Yahoo Finance (`.NS`) |
| `EPF` | Debt | Manual (8.25% p.a.) |
| `PPF` | Debt | Manual (7.10% p.a.) |

## 📜 License

MIT
