
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_DIR = path.join(process.cwd(), 'data', 'investment');
const files = fs.readdirSync(DATA_DIR);

function checkSig(file) {
    const fd = fs.openSync(path.join(DATA_DIR, file), 'r');
    const buf = Buffer.alloc(10);
    fs.readSync(fd, buf, 0, 10, 0);
    fs.closeSync(fd);
    return { hex: buf.toString('hex'), str: buf.toString('utf8').replace(/[\x00-\x1F]/g, '.') };
}

for (const file of files) {
    if (fs.statSync(path.join(DATA_DIR, file)).isDirectory()) continue;
    console.log(`\n=== ${file} ===`);
    try {
        const sig = checkSig(file);
        console.log(`Sig: ${sig.hex} | ${sig.str}`);

        if (file.endsWith('.xlsx')) {
            try {
                const wb = XLSX.readFile(path.join(DATA_DIR, file));
                console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
                for (const sn of wb.SheetNames) {
                    const sheet = wb.Sheets[sn];
                    const range = sheet['!ref'] || 'Empty';
                    console.log(` - ${sn}: Range ${range}`);
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    console.log('   Headers:', JSON.stringify(json[0]));
                    console.log('   Row 1:', JSON.stringify(json[1]));
                }
            } catch (e) {
                console.log(`XLSX Error: ${e.message}`);
            }
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}
