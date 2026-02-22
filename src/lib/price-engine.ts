import { Instrument, LivePrice, MarketStatus } from '@/types';

// ===== Price Cache =====
const priceCache = new Map<string, { price: LivePrice; timestamp: number }>();
const CACHE_TTL = 15000; // 15 seconds

function getCachedPrice(ticker: string): LivePrice | null {
    const cached = priceCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.price;
    }
    return null;
}

function setCachedPrice(ticker: string, price: LivePrice): void {
    priceCache.set(ticker, { price, timestamp: Date.now() });
}

// ===== Yahoo Finance Fetcher =====
async function fetchYahooPrice(ticker: string): Promise<LivePrice | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            next: { revalidate: 0 },
        });

        if (!res.ok) return null;

        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const currentPrice = meta.regularMarketPrice ?? 0;
        const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;
        const currency = meta.currency === 'USD' ? 'USD' as const : 'INR' as const;

        const dayChange = currentPrice - previousClose;
        const dayChangePercent = previousClose > 0 ? (dayChange / previousClose) * 100 : 0;

        const livePrice: LivePrice = {
            ticker,
            currentPrice,
            previousClose,
            dayChange,
            dayChangePercent,
            lastUpdated: new Date().toISOString(),
            currency,
        };

        setCachedPrice(ticker, livePrice);
        return livePrice;
    } catch (err) {
        console.error(`Failed to fetch Yahoo price for ${ticker}:`, err);
        return null;
    }
}

// ===== AMFI MF NAV Fetcher =====
async function fetchMFNav(amfiCode: string): Promise<LivePrice | null> {
    try {
        const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}/latest`, {
            next: { revalidate: 0 },
        });
        if (!res.ok) return null;
        const data = await res.json();

        if (!data?.data?.[0]) return null;

        const latestNav = parseFloat(data.data[0].nav);
        // Try to get previous day NAV
        let previousNav = latestNav;
        if (data.data.length > 1) {
            previousNav = parseFloat(data.data[1]?.nav ?? latestNav);
        }

        const dayChange = latestNav - previousNav;
        const dayChangePercent = previousNav > 0 ? (dayChange / previousNav) * 100 : 0;

        const livePrice: LivePrice = {
            ticker: amfiCode,
            currentPrice: latestNav,
            previousClose: previousNav,
            dayChange,
            dayChangePercent,
            lastUpdated: new Date().toISOString(),
            currency: 'INR',
        };

        setCachedPrice(amfiCode, livePrice);
        return livePrice;
    } catch (err) {
        console.error(`Failed to fetch MF NAV for ${amfiCode}:`, err);
        return null;
    }
}

// ===== SGB Calculator =====
function calculateSGBPrice(goldPricePerGram: number, instrument: Instrument): LivePrice {
    const buyDate = instrument.buyDate ? new Date(instrument.buyDate) : new Date('2024-02-28');
    const daysSincePurchase = Math.floor((Date.now() - buyDate.getTime()) / (1000 * 60 * 60 * 24));
    const annualInterest = instrument.avgBuyPrice * 0.025;
    const accruedInterest = (annualInterest * daysSincePurchase) / 365;

    // SGB value = gold price per gram (each unit = 1 gram) + accrued interest per unit
    const currentPrice = goldPricePerGram + (accruedInterest / instrument.quantity);

    // For SGB, previousClose is the price without today's interest accrual
    // This gives a small daily change reflecting interest + gold movement
    const yesterdayInterest = (annualInterest * Math.max(0, daysSincePurchase - 1)) / 365;
    const previousClose = goldPricePerGram + (yesterdayInterest / instrument.quantity);

    const dayChange = currentPrice - previousClose;
    const dayChangePercent = previousClose > 0 ? (dayChange / previousClose) * 100 : 0;

    return {
        ticker: instrument.ticker,
        currentPrice,
        previousClose,
        dayChange,
        dayChangePercent,
        lastUpdated: new Date().toISOString(),
        currency: 'INR',
    };
}

// ===== Manual Price Overrides =====
const MANUAL_OVERRIDES: Record<string, number> = {
    'z-tmcv': 483.75,   // Tata Motors DVR
    'ao-tmcv': 483.75,
    'z-sgb-feb32': 17595.99, // SGB (Ticker SGBFEB32.NS failing)
};

// ===== Resolve ticker for Yahoo =====
function resolveYahooTicker(instrument: Instrument): string {
    const t = instrument.ticker.toUpperCase();

    // Custom Mappings for Live Tracking
    if (instrument.id.includes('tmpv')) return 'TMPV.NS'; // Tata Motors PV
    if (instrument.id.includes('embassy')) return 'EMBASSY.NS'; // Embassy REIT

    // If user provided full yahoo ticker (contains a dot)
    if (t.includes('.NS') || t.includes('.BO') || t.includes('.')) {
        return t;
    }

    // Handle hyphenated tickers like EMBASSY-RR (Indian REITs/InvITs)
    switch (instrument.type) {
        case 'STOCK_IN':
        case 'GOLD_ETF':
        case 'SILVER_ETF':
        case 'REIT':
            return `${t}.NS`; // Default to NSE
        case 'SGB':
            return `${t}.NS`; // SGBs listed on NSE
        case 'STOCK_US':
        case 'PLATINUM_ETF':
        case 'COPPER_ETF':
            return t; // US tickers don't need suffix
        case 'CRYPTO':
            // Crypto tickers on Yahoo: BTC-USD, ETH-USD, etc.
            if (t.includes('-')) return t;
            return `${t}-USD`;
        default:
            return t;
    }
}

// ===== Main Price Fetcher =====
export async function fetchPrice(instrument: Instrument): Promise<LivePrice | null> {
    // Check manual override first
    if (MANUAL_OVERRIDES[instrument.id]) {
        return {
            ticker: instrument.ticker,
            currentPrice: MANUAL_OVERRIDES[instrument.id],
            previousClose: MANUAL_OVERRIDES[instrument.id], // No day change for overrides
            dayChange: 0,
            dayChangePercent: 0,
            lastUpdated: new Date().toISOString(),
            currency: 'INR',
        };
    }

    // Check cache first
    const cacheKey = instrument.amfiCode || instrument.ticker;
    const cached = getCachedPrice(cacheKey);
    if (cached) return cached;

    // Mutual Funds use AMFI API
    if (instrument.type === 'MUTUAL_FUND' && instrument.amfiCode) {
        return fetchMFNav(instrument.amfiCode);
    }

    // EPF/PPF - static, return stored value as "price"
    if (instrument.type === 'EPF' || instrument.type === 'PPF') {
        return {
            ticker: instrument.ticker,
            currentPrice: instrument.avgBuyPrice,
            previousClose: instrument.avgBuyPrice,
            dayChange: 0,
            dayChangePercent: 0,
            lastUpdated: new Date().toISOString(),
            currency: 'INR',
        };
    }

    // SGB - try exchange price first, fallback to gold calculation
    if (instrument.type === 'SGB') {
        const yahooTicker = resolveYahooTicker(instrument);
        const exchangePrice = await fetchYahooPrice(yahooTicker);
        if (exchangePrice && exchangePrice.currentPrice > 0) {
            return exchangePrice;
        }
        // Fallback: calculate from gold spot price
        console.log(`SGB ${instrument.ticker}: Exchange price unavailable, falling back to gold spot calculation`);

        // Try Indian gold ETF price first (GOLDBEES tracks gold in INR)
        const goldbeesPrice = await fetchYahooPrice('GOLDBEES.NS');
        if (goldbeesPrice && goldbeesPrice.currentPrice > 0) {
            // GOLDBEES NAV ≈ 1/100th of 1 gram gold price. Each unit ≈ 0.01g of gold.
            // SGB unit = 1 gram, so SGB price ≈ GOLDBEES price × 100 (approx)
            // More accurate: use GC=F (international gold)
        }

        // Use international gold spot (GC=F) as primary fallback
        const goldPrice = await fetchYahooPrice('GC=F');
        if (goldPrice && goldPrice.currentPrice > 0) {
            // GC=F is in USD per troy ounce. Convert to INR per gram.
            const usdInr = await fetchUSDINR();
            const goldPricePerGram = (goldPrice.currentPrice * usdInr) / 31.1035;
            return calculateSGBPrice(goldPricePerGram, instrument);
        }

        // Last resort: use a reasonable gold price per gram in INR (approx ₹7,500/gram as of 2026)
        console.warn(`SGB ${instrument.ticker}: All gold price sources failed, using estimated gold price`);
        return calculateSGBPrice(7500, instrument);
    }

    // CRYPTO - fetch USD price and convert to INR if needed
    if (instrument.type === 'CRYPTO') {
        const yahooTicker = resolveYahooTicker(instrument);
        const price = await fetchYahooPrice(yahooTicker);
        if (price && price.currentPrice > 0) {
            // If instrument is stored in INR (Indian exchange) but Yahoo returns USD, convert
            if (instrument.currency === 'INR' && price.currency === 'USD') {
                const usdInr = await fetchUSDINR();
                return {
                    ...price,
                    currentPrice: price.currentPrice * usdInr,
                    previousClose: price.previousClose * usdInr,
                    dayChange: price.dayChange * usdInr,
                    // dayChangePercent stays the same (it's a ratio)
                    currency: 'INR',
                };
            }
            return price;
        }
        return null;
    }

    // All other instruments via Yahoo Finance
    const yahooTicker = resolveYahooTicker(instrument);
    return fetchYahooPrice(yahooTicker);
}

// ===== Batch Price Fetcher =====
export async function fetchAllPrices(instruments: Instrument[]): Promise<Map<string, LivePrice>> {
    const prices = new Map<string, LivePrice>();

    // Fetch in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < instruments.length; i += batchSize) {
        const batch = instruments.slice(i, i + batchSize);
        await Promise.allSettled(
            batch.map(async (inst) => {
                const price = await fetchPrice(inst);
                if (price) {
                    prices.set(inst.id, price);
                }
            })
        );
        // Small delay between batches
        if (i + batchSize < instruments.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return prices;
}

// ===== USD/INR =====
let cachedUsdInr: { rate: number; timestamp: number } | null = null;

export async function fetchUSDINR(): Promise<number> {
    if (cachedUsdInr && Date.now() - cachedUsdInr.timestamp < 60000) {
        return cachedUsdInr.rate;
    }

    const price = await fetchYahooPrice('USDINR=X');
    if (price) {
        cachedUsdInr = { rate: price.currentPrice, timestamp: Date.now() };
        return price.currentPrice;
    }

    return cachedUsdInr?.rate ?? 83.5; // fallback
}

// ===== Market Status =====
export function getMarketStatus(): MarketStatus {
    const now = new Date();
    const istOffset = 5.5 * 60; // IST is UTC+5:30
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMinutes = utcMinutes + istOffset;

    const day = now.getUTCDay();
    const isWeekday = day >= 1 && day <= 5;

    // Indian market: 9:15 AM - 3:30 PM IST
    const indianOpen = isWeekday && istMinutes >= (9 * 60 + 15) && istMinutes <= (15 * 60 + 30);

    // US market: 7:00 PM - 1:30 AM IST (next day) -> 19:00 - 25:30 IST
    const usOpen = isWeekday && (istMinutes >= (19 * 60) || istMinutes <= (1 * 60 + 30));

    // Refresh interval based on market status
    let refreshInterval = 300000; // 5 minutes default
    if (indianOpen || usOpen) {
        refreshInterval = 30000; // 30 seconds during market hours
    }

    return {
        indianMarketOpen: indianOpen,
        usMarketOpen: usOpen,
        nextRefreshIn: refreshInterval,
    };
}
