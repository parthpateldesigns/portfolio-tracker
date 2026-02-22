export const USD_INR = 83.5;

export type Segment = "dashboard" | "ind_stocks" | "us_stocks" | "mutual_funds" | "epf" | "ppf" | "commodities";
export type Currency = "INR" | "USD";

export interface Holding {
    id: string;
    name: string;
    ticker?: string;
    type: string;
    subType?: "gold" | "silver" | "platinum" | "copper";
    segment: Segment;          // canonical owner — used for ALL calculations & totals
    displayInTabs?: Segment[]; // cross-list in other tabs (display only, never counted twice)
    qty?: number;          // fractional ok for US assets
    avgPriceUSD?: number;  // for USD-denominated assets
    currentPriceUSD?: number;
    avgPriceINR?: number;  // for INR-denominated assets
    currentPriceINR?: number;
    investedINR: number;   // always INR
    currentINR: number;    // always INR (converted if USD)
    currency: Currency;
    broker?: string;
    note?: string;
}

// Helper: USD holding builder
const usd = (
    id: string, name: string, ticker: string, type: string,
    segment: Segment, qty: number, avgPriceUSD: number, currentPriceUSD: number,
    broker = "Indmoney", subType?: Holding["subType"]
): Holding => ({
    id, name, ticker, type, segment, qty, avgPriceUSD, currentPriceUSD,
    subType, broker, currency: "USD",
    investedINR: Math.round(qty * avgPriceUSD * USD_INR),
    currentINR: Math.round(qty * currentPriceUSD * USD_INR),
});

// Helper: INR holding builder
const inr = (
    id: string, name: string, type: string, segment: Segment,
    investedINR: number, currentINR: number, broker: string,
    overrides: Partial<Holding> = {}
): Holding => ({
    id, name, type, segment, investedINR, currentINR, broker, currency: "INR", ...overrides,
});

const stock = (
    id: string, name: string, ticker: string, segment: Segment,
    qty: number, avgPriceINR: number, currentPriceINR: number, broker: string,
    note?: string
): Holding => ({
    id, name, ticker, type: "Stock", segment, qty, avgPriceINR, currentPriceINR,
    investedINR: Math.round(qty * avgPriceINR),
    currentINR: Math.round(qty * currentPriceINR),
    broker, currency: "INR", note,
});

export const HOLDINGS: Holding[] = [
    // ── IND Stocks ──────────────────────────────────────────────────────────────
    stock("z-hdfcbank", "HDFC Bank", "HDFCBANK", "ind_stocks", 16, 655, 1720, "Zerodha"),
    stock("z-infy", "Infosys", "INFY", "ind_stocks", 6, 1004, 1850, "Zerodha"),
    stock("z-icicibank", "ICICI Bank", "ICICIBANK", "ind_stocks", 6, 542, 1250, "Zerodha"),
    stock("z-itc", "ITC Limited", "ITC", "ind_stocks", 35, 182, 420, "Zerodha"),
    stock("z-hcltech", "HCL Technologies", "HCLTECH", "ind_stocks", 8, 1082, 1580, "Zerodha"),
    stock("z-axisbank", "Axis Bank", "AXISBANK", "ind_stocks", 8, 618, 1080, "Zerodha"),
    stock("z-vbl", "Varun Beverages", "VBL", "ind_stocks", 6, 586, 480, "Zerodha"),
    stock("z-titan", "Titan Company", "TITAN", "ind_stocks", 1, 1064, 3250, "Zerodha"),
    stock("z-techm", "Tech Mahindra", "TECHM", "ind_stocks", 1, 753, 1450, "Zerodha"),
    stock("z-jiofin", "Jio Financial Services", "JIOFIN", "ind_stocks", 6, 328, 290, "Zerodha"),
    stock("z-hdfclife", "HDFC Life Insurance", "HDFCLIFE", "ind_stocks", 8, 563, 680, "Zerodha"),
    stock("ao-irfc", "Ind Railway Finance Corp", "IRFC", "ind_stocks", 119, 132, 170, "AngelOne"),
    stock("ao-dpwires", "D P Wires Limited", "DPWIRES", "ind_stocks", 34, 188, 310, "AngelOne"),
    stock("ao-federal", "Federal Bank", "FEDERALBNK", "ind_stocks", 10, 84, 188, "AngelOne"),
    stock("z-kellton", "Kellton Tech Solutions", "KELLTONTEC", "ind_stocks", 605, 20, 38, "Multiple"),
    stock("z-escorts", "Escorts Kubota", "ESCORTS", "ind_stocks", 1, 940, 3180, "Zerodha"),
    stock("z-itchotels", "ITC Hotels", "ITCHOTELS", "ind_stocks", 3, 280, 195, "Zerodha"),
    stock("z-tmcv", "Tata Motors DVR", "TMCV", "ind_stocks", 15, 270, 0, "Multiple", "Delisted"),
    {
        id: "z-embassy", name: "Embassy Office REIT", ticker: "EMBASSY-RR", type: "REIT",
        segment: "ind_stocks", qty: 18, avgPriceINR: 346, currentPriceINR: 380,
        investedINR: 6223, currentINR: 6840, broker: "Zerodha", currency: "INR",
    },

    // ── US Stocks (fractional, USD) ─────────────────────────────────────────────
    usd("im-aapl", "Apple Inc.", "AAPL", "Stock", "us_stocks", 2.35, 165, 225),
    usd("im-nvda", "NVIDIA Corporation", "NVDA", "Stock", "us_stocks", 3.12, 450, 875),
    usd("im-msft", "Microsoft Corp", "MSFT", "Stock", "us_stocks", 1.00, 380, 415),
    usd("im-tsla", "Tesla Inc.", "TSLA", "Stock", "us_stocks", 2.75, 195, 340),
    usd("im-googl", "Alphabet Inc.", "GOOGL", "Stock", "us_stocks", 1.50, 140, 195),

    // ── Mutual Funds ─────────────────────────────────────────────────────────────
    inr("mf-1", "Mirae Asset Large Cap Fund", "Mutual Fund", "mutual_funds", 75000, 98400, "Zerodha Coin"),
    inr("mf-2", "Parag Parikh Flexi Cap Fund", "Mutual Fund", "mutual_funds", 60000, 84200, "Zerodha Coin"),
    inr("mf-3", "Axis Small Cap Fund", "Mutual Fund", "mutual_funds", 30000, 39800, "Zerodha Coin"),
    inr("mf-4", "HDFC Mid-Cap Opportunities", "Mutual Fund", "mutual_funds", 45000, 62300, "Zerodha Coin"),
    inr("mf-5", "Nifty 50 Index Fund – UTI", "Index Fund", "mutual_funds", 50000, 65500, "Zerodha Coin"),

    // ── EPF ───────────────────────────────────────────────────────────────────────
    inr("epf-1", "Employee Provident Fund", "EPF", "epf", 380000, 432000, "EPFO"),

    // ── PPF ───────────────────────────────────────────────────────────────────────
    inr("ppf-1", "Public Provident Fund", "PPF", "ppf", 150000, 188000, "SBI"),

    // ── Commodities ───────────────────────────────────────────────────────────────
    // Gold (INR, via Zerodha Kite) → also shown in IND Stocks tab
    {
        id: "z-goldbees", name: "Gold BeES", ticker: "GOLDBEES", type: "Gold ETF", subType: "gold",
        segment: "commodities", displayInTabs: ["ind_stocks"],
        qty: 161, avgPriceINR: 68, currentPriceINR: 87,
        investedINR: 10954, currentINR: 14007, broker: "Zerodha", currency: "INR",
    },
    {
        id: "z-sgb", name: "SGB Feb 2032", ticker: "SGBFEB32IV", type: "SGB", subType: "gold",
        segment: "commodities", displayInTabs: ["ind_stocks"],
        qty: 1, avgPriceINR: 6213, currentPriceINR: 8950,
        investedINR: 6213, currentINR: 8950, broker: "Zerodha", currency: "INR",
    },
    // Silver (INR, via Zerodha Kite) → also shown in IND Stocks tab
    {
        id: "z-silver", name: "Silver BeES", ticker: "SILVERBEES", type: "Silver ETF", subType: "silver",
        segment: "commodities", displayInTabs: ["ind_stocks"],
        qty: 58, avgPriceINR: 152, currentPriceINR: 198,
        investedINR: 8833, currentINR: 11484, broker: "Zerodha", currency: "INR",
    },
    // Platinum (USD via Indmoney) → also shown in US Stocks tab
    { ...usd("im-platinum", "Platinum ETF", "PLTM", "Platinum ETF", "commodities", 10.5, 9.20, 11.80, "Indmoney", "platinum"), displayInTabs: ["us_stocks"] },
    // Copper (USD via Indmoney) → also shown in US Stocks tab
    { ...usd("im-copper", "Copper ETF", "CPER", "Copper ETF", "commodities", 35.25, 22.50, 25.80, "Indmoney", "copper"), displayInTabs: ["us_stocks"] },
];

export const SEGMENT_META: Record<string, { label: string; color: string; icon: string }> = {
    ind_stocks: { label: "IND Stocks", color: "#4f8ef7", icon: "🇮🇳" },
    us_stocks: { label: "US Stocks", color: "#9b7bff", icon: "🇺🇸" },
    mutual_funds: { label: "Mutual Funds", color: "#27c37b", icon: "📊" },
    epf: { label: "EPF", color: "#e07b39", icon: "🏛" },
    ppf: { label: "PPF", color: "#d4a030", icon: "🏦" },
    commodities: { label: "Commodities", color: "#c9a84c", icon: "🪙" },
};

export const COMMODITY_META: Record<string, { label: string; color: string }> = {
    gold: { label: "Gold (ETF + SGB)", color: "#c9a84c" },
    silver: { label: "Silver ETF", color: "#8fa3b1" },
    platinum: { label: "Platinum ETF (USD)", color: "#b0c4de" },
    copper: { label: "Copper ETF (USD)", color: "#b87333" },
};
