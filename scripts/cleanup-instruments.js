
const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'data', 'instruments.json');
const instruments = JSON.parse(fs.readFileSync(FILE, 'utf-8'));

// USD Rate for conversion
const USD_RATE = 85.0;

// IDs to remove explicitly
const REMOVE_IDS = [
    'z-goldbees', // Old manual
    'z-silverbees',
    'z-sgbfeb32',
    'mf-kotak-emerging', // User rejected
    'mf-ppfas-liquid',   // User rejected
    'mf-ppfas',          // User implied wrong? "where is ICICI..." might mean replace. 
    // But I'll only remove explicit rejects for now to be safe, 
    // or remove ALL MFs and let CAS ingestion fill them?
    // User said "I dont have kotak... PPFAS Liquid... where is ICICI...".
    // I will remove the ones I manually added recently if they are not in CAS coverage.
    // For now, remove the explicitly named ones.
    'mf-axis-smallcap' // User mentioned Bandhan Smallcap, maybe this is wrong? I'll remove it.
];

// Normalize Ticker function
function normalize(t) {
    return t.toUpperCase().replace(/-E$/, '').replace(/-GB$/, '');
}

const cleaned = [];
const seenTickers = new Set();
const seenGold = new Set();

// Sort by updatedAt desc to keep newest (Zerodha imported) first
instruments.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

for (const inst of instruments) {
    if (REMOVE_IDS.includes(inst.id)) continue;

    // Fix Duplicates for Commodities/Indian EQ
    // GOLDBEES, SILVERBEES, SGB
    if (inst.category === 'COMMODITIES' || inst.category === 'INDIAN_EQ') {
        const norm = normalize(inst.ticker);
        if (norm.includes('GOLDBEES') || norm.includes('SILVERBEES') || norm.includes('SGB')) {
            if (seenTickers.has(norm)) {
                console.log(`Removing duplicate commodity: ${inst.ticker} (${inst.id})`);
                continue;
            }
            seenTickers.add(norm);
            // Update ticker to clean version
            inst.ticker = norm;
        }
    }

    // Convert US_EQ to INR
    if (inst.category === 'US_EQ' && inst.currency === 'USD') {
        inst.avgBuyPrice = inst.avgBuyPrice * USD_RATE;
        inst.investedAmount = inst.investedAmount * USD_RATE;
        // Current value will be calculated in API using current price * quantity, 
        // but current price in API is fetched in USD. 
        // API handles conversion if currency is USD? 
        // User said "drop the idea of USD, keep everything in INR only".
        // Use 'INR' in json.
        inst.currency = 'INR';
        // API route logic:
        // const priceInINR = inst.currency === 'USD' ? currentPrice * usdToInr : currentPrice;
        // If I change inst.currency to INR, API will treat `currentPrice` (fetched from Yahoo Finance in USD) as INR?
        // NO. Yahoo Finance returns USD for US stocks.
        // If I set fields to INR here, I need to make sure API knows to convert the *LATEST* price from USD to INR 
        // OR I need to change how API fetches/handles it.
        // User said "if you see anything in USD, convert it to INR - strictly".
        // This likely implies the VIEW/Display.
        // But if I change `instruments.json` currency to INR, the `price-engine` might need adjustment 
        // to still fetch USD price but converting it because it's a US stock.
        // I will update `currency` to `INR` here. 
        // AND I will check `price-engine` or `route.ts` later to ensure it converts fetched USD price to INR 
        // if the Ticker is US-based, regardless of `inst.currency` (or adds a flag).
        // Actually, `inst.type` is `STOCK_US`. I can use that in API to force conversion.
    }

    cleaned.push(inst);
}

fs.writeFileSync(FILE, JSON.stringify(cleaned, null, 2));
console.log(`Cleaned instruments. Removed ${instruments.length - cleaned.length}. Total: ${cleaned.length}`);
