
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_DIR = path.join(process.cwd(), 'data', 'investment');

function inspect() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx'));

    for (const file of files) {
        console.log(`\n--- Inspecting ${file} ---`);
        const workbook = XLSX.readFile(path.join(DATA_DIR, file));
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays

        if (data.length > 0) {
            console.log('Headers:', data[0]);
            console.log('Sample Row:', data[1]);
        } else {
            console.log('Empty sheet');
        }
    }
}

inspect();
