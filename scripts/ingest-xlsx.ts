
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { Instrument, InstrumentType, InstrumentCategory } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data', 'investment');
const INSTRUMENTS_FILE = path.join(process.cwd(), 'data', 'instruments.json');

// Helper to determine type/category from ticker or name
function guessTypeCategory(ticker: string, name: string): { type: InstrumentType; category: InstrumentCategory } {
    const t = ticker.toUpperCase();
    const n = name.toUpperCase();

    if (n.includes('MUTUAL FUND') || n.includes('DIRECT GROWTH')) return { type: 'MUTUAL_FUND', category: 'MUTUAL_FUNDS' };
    if (t.includes('SGB')) return { type: 'SGB', category: 'COMMODITIES' };
    if (t.includes('GOLD')) return { type: 'GOLD_ETF', category: 'COMMODITIES' };
    if (t.includes('SILVER')) return { type: 'SILVER_ETF', category: 'COMMODITIES' };
    if (t.includes('REIT')) return { type: 'REIT', category: 'REITS' };

    // Default to Indian Stock
    return { type: 'STOCK_IN', category: 'INDIAN_EQ' };
}

function parseExcel() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx'));

    let newInstruments: Instrument[] = [];
    const existingInstruments: Instrument[] = JSON.parse(fs.readFileSync(INSTRUMENTS_FILE, 'utf-8'));

    for (const file of files) {
        console.log(`Processing ${file}...`);
        const workbook = XLSX.readFile(path.join(DATA_DIR, file));
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data: any[] = XLSX.utils.sheet_to_json(sheet);

        // Zerodha format usually has: Instrument, Qty., Avg. cost, Cur. val, P&L, Net chg.
        // Normalized check
        for (const row of data) {
            // Check for Zerodha specific columns or try to map
            // Zerodha: 'Instrument', 'Qty.', 'Avg. cost'
            // INDMoney/Others might differ.

            let ticker = row['Instrument'] || row['Symbol'] || row['Ticker'];
            let name = row['Instrument'] || row['Security Name'] || row['Name']; // specific logic needed maybe
            let qty = row['Qty.'] || row['Quantity'] || row['Units'];
            let avg = row['Avg. cost'] || row['Average Cost'] || row['Avg Price'];

            if (!ticker || !qty) continue;

            // Clean up
            if (typeof qty === 'string') qty = parseFloat(qty.replace(/,/g, ''));
            if (typeof avg === 'string') avg = parseFloat(avg.replace(/,/g, ''));

            const { type, category } = guessTypeCategory(ticker, name || ticker);

            // Check if exists
            const exists = existingInstruments.find(i => i.ticker === ticker);
            if (exists) {
                console.log(`Skipping existing: ${ticker}`);
                continue;
            }

            const newInst: Instrument = {
                id: `imported-${ticker.toLowerCase().replace(/\s+/g, '-')}`,
                ticker: ticker,
                name: name || ticker,
                type,
                category,
                commodityType: null, // refined later
                quantity: Number(qty),
                avgBuyPrice: Number(avg),
                buyDate: null,
                investedAmount: Number(qty) * Number(avg),
                exchange: 'NSE', // Default
                amfiCode: null,
                currency: 'INR',
                notes: `Imported from ${file}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            newInstruments.push(newInst);
        }
    }

    console.log(`Found ${newInstruments.length} new instruments.`);
    if (newInstruments.length > 0) {
        const updated = [...existingInstruments, ...newInstruments];
        fs.writeFileSync(INSTRUMENTS_FILE, JSON.stringify(updated, null, 2));
        console.log('Updated instruments.json');
    }
}

parseExcel();
