
const pdfLib = require('pdf-parse');
console.log('Type of pdfLib:', typeof pdfLib);
console.log('Keys of pdfLib:', Object.keys(pdfLib));
if (typeof pdfLib === 'function') {
    console.log('It is a function');
} else if (pdfLib.default && typeof pdfLib.default === 'function') {
    console.log('It has a default function');
}

const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'data', 'investment', 'cas_summary_report_2026_02_15_120449.pdf');

async function test() {
    try {
        const buffer = fs.readFileSync(file);
        const parse = typeof pdfLib === 'function' ? pdfLib : pdfLib.default;
        const data = await parse(buffer);
        console.log('Text length:', data.text.length);
        console.log('Preview:', data.text.substring(0, 200));
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
