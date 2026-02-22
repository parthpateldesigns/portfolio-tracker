
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pdf = require('pdf-parse');

const DATA_DIR = path.join(process.cwd(), 'data', 'investment');
const files = fs.readdirSync(DATA_DIR);

async function inspect() {
    for (const file of files) {
        if (fs.statSync(path.join(DATA_DIR, file)).isDirectory()) continue;

        if (file.endsWith('.xlsx')) {
            console.log(`\n=== Analyzing Excel: ${file} ===`);
            try {
                const wb = XLSX.readFile(path.join(DATA_DIR, file));
                for (const sn of wb.SheetNames) {
                    const sheet = wb.Sheets[sn];
                    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                    let headerIndex = -1;
                    for (let i = 0; i < Math.min(data.length, 30); i++) {
                        const rowStr = JSON.stringify(data[i]).toLowerCase();
                        if (rowStr.includes('symbol') || rowStr.includes('instrument') || rowStr.includes('scrip') || rowStr.includes('security')) {
                            headerIndex = i;
                            console.log(`[${sn}] Found likely header at row ${i}:`, JSON.stringify(data[i]));
                            if (data[i + 1]) console.log(`[${sn}] Sample Data Row 1:`, JSON.stringify(data[i + 1]));
                            if (data[i + 2]) console.log(`[${sn}] Sample Data Row 2:`, JSON.stringify(data[i + 2]));
                            break;
                        }
                    }
                    if (headerIndex === -1 && data.length > 0) {
                        console.log(`[${sn}] No clear header found in first 30 rows. First row:`, JSON.stringify(data[0]));
                    }
                }
            } catch (e) {
                console.log(`XLSX Error on ${file}: ${e.message}`);
            }
        } else if (file.endsWith('.pdf')) {
            console.log(`\n=== Analyzing PDF: ${file} ===`);
            try {
                const dataBuffer = fs.readFileSync(path.join(DATA_DIR, file));
                const data = await pdf(dataBuffer);
                // Print first 500 chars to see structure
                console.log(`PDF Text Preview (first 800 chars):\n${data.text.substring(0, 800)}`);
            } catch (e) {
                console.log(`PDF Error on ${file}: ${e.message}`);
            }
        }
    }
}

inspect();
