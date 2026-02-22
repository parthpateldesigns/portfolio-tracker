
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_DIR = path.join(process.cwd(), 'data', 'investment');
const INSTRUMENTS_FILE = path.join(process.cwd(), 'data', 'instruments.json');
const ZERODHA_FILE = 'holdings-UK6284.xlsx';

function guessTypeCategory(ticker, name) {
    const t = ticker.toUpperCase();
    const n = name.toUpperCase();

    if (n.includes('MUTUAL FUND')) return { type: 'MUTUAL_FUND', category: 'MUTUAL_FUNDS' };
    if (t.includes('SGB') || n.includes('SOVEREIGN GOLD')) return { type: 'SGB', category: 'COMMODITIES' };
    if (t.includes('GOLDBEES') || t.includes('GOLD ETF')) return { type: 'GOLD_ETF', category: 'COMMODITIES' };
    if (t.includes('SILVERBEES') || t.includes('SILVER ETF')) return { type: 'SILVER_ETF', category: 'COMMODITIES' };
    if (t.includes('REIT') || n.includes('REIT')) return { type: 'REIT', category: 'REITS' };
    if (t.includes('INVIT')) return { type: 'REIT', category: 'REITS' }; // Treat InvITs as REITs for now or add correct cat

    // Default
    return { type: 'STOCK_IN', category: 'INDIAN_EQ' };
}

function normalizeTicker(t) {
    return t.trim().toUpperCase().replace(/\s+/g, '-');
}

function run() {
    console.log('Starting ingestion from ' + ZERODHA_FILE);
    const filePath = path.join(DATA_DIR, ZERODHA_FILE);

    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    const wb = XLSX.readFile(filePath);
    let existingInstruments = [];
    if (fs.existsSync(INSTRUMENTS_FILE)) {
        existingInstruments = JSON.parse(fs.readFileSync(INSTRUMENTS_FILE, 'utf8'));
    }

    const instrumentsMap = new Map();
    existingInstruments.forEach(i => instrumentsMap.set(normalizeTicker(i.ticker), i));

    let processedCount = 0;
    let addedCount = 0;
    let updatedCount = 0;

    // Process Equity Sheet
    // Usually named "Equity" or similar
    const equitySheetName = wb.SheetNames.find(s => s.toLowerCase().includes('equity'));
    if (equitySheetName) {
        console.log(`Processing Equity sheet: ${equitySheetName}`);
        const sheet = wb.Sheets[equitySheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Find header
        let headerRowIdx = -1;
        let colMap = {};

        for (let i = 0; i < data.length; i++) {
            const row = data[i].map(c => String(c).toLowerCase());
            if (row.includes('symbol') && (row.includes('quantity') || row.includes('quantity available'))) {
                headerRowIdx = i;
                row.forEach((h, idx) => {
                    if (h.includes('symbol')) colMap.symbol = idx;
                    if (h === 'quantity available') colMap.qtyAvailable = idx; // Exact match preferred
                    if (h.includes('pledged (margin)')) colMap.qtyMargin = idx;
                    if (h.includes('pledged (loan)')) colMap.qtyLoan = idx;
                    if (h.includes('average price')) colMap.price = idx;
                    if (h.includes('isin')) colMap.isin = idx;
                    if (h.includes('sector')) colMap.sector = idx;
                });
                break;
            }
        }

        if (headerRowIdx !== -1) {
            for (let i = headerRowIdx + 1; i < data.length; i++) {
                const row = data[i];
                const ticker = row[colMap.symbol];
                if (!ticker) continue;

                const qtyAvailable = parseFloat(row[colMap.qtyAvailable]) || 0;
                const qtyMargin = parseFloat(row[colMap.qtyMargin]) || 0;
                const qtyLoan = parseFloat(row[colMap.qtyLoan]) || 0;
                const totalQty = qtyAvailable + qtyMargin + qtyLoan;

                const avgPrice = parseFloat(row[colMap.price]) || 0;

                if (totalQty <= 0) continue;

                const { type, category } = guessTypeCategory(ticker, ticker); // Name is same as ticker in Zerodha xlsx usually

                const normTicker = normalizeTicker(ticker);
                const existing = instrumentsMap.get(normTicker);

                const instrument = {
                    ...(existing || {}),
                    id: existing ? existing.id : `zerodha-${normTicker.toLowerCase()}`,
                    ticker: ticker,
                    name: existing ? existing.name : ticker, // Keep existing name if present (better formatting)
                    type: existing ? existing.type : type,   // Keep existing type if fixed manually
                    category: existing ? existing.category : category,
                    quantity: totalQty,
                    avgBuyPrice: avgPrice,
                    investedAmount: totalQty * avgPrice,
                    currency: 'INR',
                    updatedAt: new Date().toISOString(),
                    // Fields to preserve if new
                    createdAt: existing ? existing.createdAt : new Date().toISOString(),
                    notes: existing ? existing.notes : 'Imported from Zerodha',
                    commodityType: existing ? existing.commodityType : null,
                    exchange: existing ? existing.exchange : 'NSE',
                    amfiCode: existing ? existing.amfiCode : null,
                    buyDate: existing ? existing.buyDate : null,
                };

                instrumentsMap.set(normTicker, instrument);
                if (existing) updatedCount++; else addedCount++;
                processedCount++;
            }
        } else {
            console.log('Could not find header row in Equity sheet');
        }
    }

    // Process Mutual Funds Sheet
    const mfSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('mutual'));
    if (mfSheetName) {
        console.log(`Processing Mutual Funds sheet: ${mfSheetName}`);
        const sheet = wb.Sheets[mfSheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let headerRowIdx = -1;
        let colMap = { name: -1, qty: -1, price: -1, isin: -1 };

        // Scan for header row
        for (let i = 0; i < Math.min(data.length, 40); i++) {
            const row = data[i].map(c => String(c).toLowerCase());
            // Zerodha MF header usually has "ISIN" and "Average Price"
            if (row.includes('isin') && (row.includes('average price') || row.includes('avg. cost') || row.includes('nav'))) {
                headerRowIdx = i;
                // Map columns
                row.forEach((h, idx) => {
                    if (h.includes('fund name') || h.includes('symbol') || h === '') {
                        // Sometimes Name column header is empty or merged, but usually first
                        if (idx === 0) colMap.name = 0;
                    }
                    if (h.includes('isin')) colMap.isin = idx;
                    if (h.includes('quantity') && !h.includes('discrepant')) {
                        // Prefer "Quantity Available" or just "Quantity"
                        if (colMap.qty === -1) colMap.qty = idx;
                    }
                    if (h.includes('average price')) colMap.price = idx;
                });

                // Fallback if name not found explicitly but is first col
                if (colMap.name === -1) colMap.name = 0;

                // Fallback for Quantity if "Quantity" word is split or vague
                // Based on inspection: Col 3 is Qty
                if (colMap.qty === -1) colMap.qty = 3;

                // Fallback for Price
                // Based on inspection: Col 7 is Price
                if (colMap.price === -1) colMap.price = 7;

                console.log(`Found MF Header at row ${i}. Map:`, colMap);
                break;
            }
        }

        if (headerRowIdx !== -1) {
            for (let i = headerRowIdx + 1; i < data.length; i++) {
                const row = data[i];
                // Name is usually in col 0
                const name = row[colMap.name];
                if (!name || !String(name).trim()) continue;

                // Ticker logic: Use ISIN if available, else Name
                const isin = row[colMap.isin];

                const qty = parseFloat(row[colMap.qty]) || 0;
                const avgPrice = parseFloat(row[colMap.price]) || 0;

                if (qty <= 0) continue;

                // Try to match existing by Name or ISIN (if we stored ISIN)
                // We don't have ISIN in instrument interface yet, but we can match by Name logic
                let matchedKey = null;
                for (const [key, val] of instrumentsMap.entries()) {
                    // Fuzzy match name or exact match
                    if (val.type === 'MUTUAL_FUND' && val.name.toLowerCase() === String(name).toLowerCase()) {
                        matchedKey = key;
                        break;
                    }
                }

                const normTicker = matchedKey || (isin ? isin : `MF-${String(name).substring(0, 15).replace(/[^a-zA-Z0-9]/g, '-')}`).toUpperCase();
                const existing = instrumentsMap.get(normTicker) || (matchedKey ? instrumentsMap.get(matchedKey) : null);

                const instrument = {
                    ...(existing || {}),
                    id: existing ? existing.id : `zerodha-mf-${normTicker.toLowerCase()}`,
                    ticker: existing ? existing.ticker : String(name).substring(0, 20),
                    name: String(name),
                    type: 'MUTUAL_FUND',
                    category: 'MUTUAL_FUNDS',
                    quantity: qty,
                    avgBuyPrice: avgPrice,
                    investedAmount: qty * avgPrice,
                    currency: 'INR',
                    updatedAt: new Date().toISOString(),
                    createdAt: existing ? existing.createdAt : new Date().toISOString(),
                    notes: existing ? existing.notes : `Imported from Zerodha directly. ISIN: ${isin || 'N/A'}`,
                    exchange: 'AMFI',
                    commodityType: null
                };

                instrumentsMap.set(normTicker, instrument);
                if (existing) updatedCount++; else addedCount++;
                processedCount++;
            }
        } else {
            console.log('Could not find header row in Mutual Funds sheet. Trying hardcoded index 22.');
            // Hardcoded fallback if simple search fails
            const fallbackHeaderRow = 22;
            if (data.length > fallbackHeaderRow) {
                // Assume standard Zerodha: 0=Name, 1=ISIN, 3=Qty, 7=AvgPrice
                for (let i = fallbackHeaderRow + 1; i < data.length; i++) {
                    const row = data[i];
                    const name = row[0];
                    if (!name) continue;
                    const qty = parseFloat(row[3]);
                    const price = parseFloat(row[7]);
                    if (!qty) continue;

                    const instrument = {
                        id: `zerodha-mf-${String(name).substring(0, 10).replace(/\s/g, '')}`,
                        ticker: String(name).substring(0, 20),
                        name: String(name),
                        type: 'MUTUAL_FUND',
                        category: 'MUTUAL_FUNDS',
                        quantity: qty,
                        avgBuyPrice: price,
                        investedAmount: qty * price,
                        currency: 'INR',
                        exchange: 'AMFI',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        notes: 'Imported via fallback (Row 22)',
                        commodityType: null
                    };

                    // Key by normalized name for now to avoid dupes if possible
                    const key = `MF-${String(name).substring(0, 10).toUpperCase()}`;
                    if (!instrumentsMap.has(key)) {
                        instrumentsMap.set(key, instrument);
                        addedCount++;
                    } else {
                        // Update
                        const ext = instrumentsMap.get(key);
                        instrumentsMap.set(key, { ...ext, quantity: qty, avgBuyPrice: price, investedAmount: qty * price });
                        updatedCount++;
                    }
                    processedCount++;
                }
            }
        }
    }

    // Save
    const sortedInstruments = Array.from(instrumentsMap.values()).sort((a, b) => a.category.localeCompare(b.category));
    fs.writeFileSync(INSTRUMENTS_FILE, JSON.stringify(sortedInstruments, null, 2));

    console.log(`Ingestion complete.`);
    console.log(`Processed: ${processedCount}`);
    console.log(`Added: ${addedCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Total Instruments: ${sortedInstruments.length}`);
}

run();
