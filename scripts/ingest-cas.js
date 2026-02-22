
const fs = require('fs');
const path = require('path');

// Robust PDF Import
const pdfLib = require('pdf-parse');
const pdfParse = pdfLib.PDFParse;

if (typeof pdfParse !== 'function') {
    console.error('Still cannot find PDFParse function. Keys:', Object.keys(pdfLib));
    process.exit(1);
}

const DATA_DIR = path.join(process.cwd(), 'data', 'investment');
const INSTRUMENTS_FILE = path.join(process.cwd(), 'data', 'instruments.json');
const CAS_FILE = 'cas_summary_report_2026_02_15_120449.pdf'; // Exact name from debug-pdf

async function run() {
    const filePath = path.join(DATA_DIR, CAS_FILE);
    if (!fs.existsSync(filePath)) {
        console.error('CAS file not found:', filePath);
        return;
    }

    const buffer = fs.readFileSync(filePath);
    let data;
    try {
        const parser = new pdfParse({ data: buffer });
        const result = await parser.getText();
        data = result; // getText returns result object with .text? No, look at CLI
        // CLI: result = await parser.getText(params); result has .text property?
        // CLI: const output = options.format === 'json' ? JSON.stringify(result, null, 2) : result.text;
        // So result IS an object with text property.
        await parser.destroy();
    } catch (e) {
        console.error('PDF parsing failed. Trying alternative import strategy if needed, or error:', e);
        // If it failed because pdfParse isn't a function, retry?
        // But we did checks.
        return;
    }

    const text = data.text;
    console.log('PDF Text Length:', text.length);
    console.log('Preview:', text.substring(0, 2000)); // Print enough to see structure

    // CAS Parsing Logic
    // Look for lines containing ISIN (INE...)
    // Format usually: 
    // "Nippon India ETF Gold BeES ... INF204K01019 ... <Balance> ... <Value>"
    // Or nicely tabulated.

    // Regex for ISIN: [A-Z]{3}\w{9} (e.g. INF179KB1HP9)
    // We want to capture Name (before ISIN) and Quantity/Value (after ISIN).

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    fs.writeFileSync('debug_lines.txt', lines.join('\n'));

    let instruments = [];
    if (fs.existsSync(INSTRUMENTS_FILE)) {
        instruments = JSON.parse(fs.readFileSync(INSTRUMENTS_FILE, 'utf8'));
    }
    const instrumentsMap = new Map();
    instruments.forEach(i => instrumentsMap.set(i.id, i));

    let processed = 0;
    let lineBuffer = [];

    // Regex to match the data tail: Units Date Folio NAV
    // 1,671.760 13-Feb-2026 10507309 92.0658
    const tailPattern = /([\d,]+\.\d{3})\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d+)\s+([\d.]+)\s*$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip headers/footers and preamble garbage
        if (line.includes('Page ') || line.includes('Account Summary') || line.includes('SoA Holdings') || line.includes('Demat Holdings') ||
            line.includes('Mobile:') || line.includes('Email:') || line.includes('PAN :') || line.includes('CAMS') || line.includes('KFintech') ||
            line.includes('Allocation by Asset Class') || line.includes('DEBT') || line.includes('EQUITY') || line.includes('LIQUID') ||
            line.includes('Invested Value') || line.includes('Market Value') || line.includes('Gain/Loss') || line.includes('Balance') ||
            line.includes('Scheme Details') || line.match(/^\d{6},/) // Pin code line
        ) {
            continue;
        }

        const match = line.match(tailPattern);
        if (match) {
            // Found tail
            const unitsStr = match[1];
            const dateStr = match[2];
            const folio = match[3];
            const navStr = match[4];

            const units = parseFloat(unitsStr.replace(/,/g, ''));

            if (units > 0) {
                // Combine lineBuffer + pre-tail part of current line
                const preTail = line.substring(0, match.index).trim();
                const fullText = (lineBuffer.join(' ') + ' ' + preTail).trim()
                    .replace(/Invested Value \(INR\)/g, '')
                    .replace(/Market Value \(INR\)/g, '')
                    .replace(/Gain\/Loss \(Absolute\)/g, '')
                    .replace(/Balance/g, '')
                    .replace(/Units/g, '')
                    .replace(/NAV/g, '')
                    .replace(/Date/g, '')
                    .replace(/Scheme Details/g, '')
                    .replace(/Folio No\./g, '');

                // Tokenize to find financial columns: Invested Market Gain Gain%
                // They are at the end of fullText.
                const tokens = fullText.split(/\s+/);

                // We expect: [Name parts...] Invested Market Gain Gain%
                if (tokens.length >= 5) {
                    const gainPct = tokens.pop(); // e.g. (+35.01%)
                    const gain = tokens.pop();    // e.g. 39,912.11 or (3,291.40)
                    const market = tokens.pop();  // e.g. 1,53,912.11
                    const invested = tokens.pop();// e.g. 1,14,000.00

                    // Check if they look like numbers
                    // Allow parens for negative numbers
                    const numberRegex = /^[\d,]+(\.\d+)?$|^\([\d,]+(\.\d+)?\)$/;

                    if ((numberRegex.test(market) || numberRegex.test(gain)) && (numberRegex.test(invested))) {
                        const mkVal = parseFloat(market.replace(/,/g, '').replace(/[()]/g, ''));
                        const invVal = parseFloat(invested.replace(/,/g, ''));

                        const fullName = tokens.join(' ').replace(/^[-\s]+/, '');

                        console.log(`Matched: ${fullName} | Units: ${units} | Val: ${mkVal}`);

                        const id = `cas-${fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                        const inst = {
                            id: id,
                            name: fullName,
                            ticker: fullName.substring(0, 20).toUpperCase(),
                            type: 'MUTUAL_FUND',
                            category: 'MUTUAL_FUNDS',
                            quantity: units,
                            avgBuyPrice: invVal / units,
                            investedAmount: invVal,
                            currency: 'INR',
                            notes: `Imported from CAS. Folio: ${folio}`,
                            exchange: 'AMFI',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            commodityType: null,
                            amfiCode: null
                        };

                        let found = false;
                        const normMatch = fullName.toLowerCase().replace(/\s+/g, '');
                        for (const [k, v] of instrumentsMap.entries()) {
                            const normV = v.name.toLowerCase().replace(/\s+/g, '');
                            // Fuzzy match
                            if (v.type === 'MUTUAL_FUND' && (normV.includes(normMatch) || normMatch.includes(normV))) {
                                console.log(`Updating existing ${v.name} (${k})`);
                                // Update logic: Trust CAS quantity/value
                                instrumentsMap.set(k, {
                                    ...v,
                                    quantity: units,
                                    investedAmount: invVal,
                                    avgBuyPrice: invVal / units,
                                    updatedAt: new Date().toISOString(),
                                    notes: v.notes ? v.notes : `Imported from CAS. Folio: ${folio}`
                                });
                                found = true;
                                break;
                            }
                        }

                        if (!found) {
                            instrumentsMap.set(inst.id, inst);
                            processed++;
                            console.log(`Added NEW: ${inst.name}`);
                        }
                    }
                }
            }
            lineBuffer = [];
        } else {
            // Check if line looks like part of the record or garbage
            // Lines like "MFCentralCASSummary..." are garbage
            if (!line.includes('MFCentral') && !line.includes('Consolidated Account Summary')) {
                lineBuffer.push(line);
            }
        }
    }

    // Save
    const sorted = Array.from(instrumentsMap.values());
    fs.writeFileSync(INSTRUMENTS_FILE, JSON.stringify(sorted, null, 2));
    console.log(`CAS Ingestion Complete. Total Instruments: ${sorted.length}. New/Processed: ${processed}`);
}

run();
