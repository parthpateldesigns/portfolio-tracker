
const XLSX = require('xlsx');
const wb = XLSX.readFile('data/investment/holdings-UK6284.xlsx');
const sheet = wb.Sheets['Mutual Funds']; // Use exact sheet name from precious log
// Step 209: Sheets: Equity, Mutual Funds, Combined.
if (!sheet) {
    console.log('Mutual Funds sheet not found!');
    process.exit(1);
}
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
console.log('Mutual Funds Sheet Dump (first 30 rows):');
for (let i = 0; i < 30; i++) {
    if (data[i]) console.log(`Row ${i}:`, JSON.stringify(data[i]));
}
