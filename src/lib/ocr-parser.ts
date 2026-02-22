import { ManualAddPayload, InstrumentType, InstrumentCategory, CommodityType, Exchange, TYPE_TO_CATEGORY, TYPE_TO_COMMODITY } from '@/types';

const PLATFORM_PROMPTS: Record<string, string> = {
    zerodha: `You are analyzing a screenshot from Zerodha Kite holdings page. Extract each stock/ETF/SGB with these fields:
- ticker (NSE symbol, e.g., RELIANCE, GOLDBEES, SGBFEB32)
- name (full company/instrument name)
- quantity (number of shares/units)
- avgBuyPrice (average buy price)
Do NOT include any index data or summary rows.`,

    angelone: `You are analyzing a screenshot from Angel One holdings page. Extract each stock/ETF with these fields:
- ticker (NSE/BSE symbol)
- name (full company/instrument name)
- quantity (number of shares/units)
- avgBuyPrice (average buy price)`,

    indmoney: `You are analyzing a screenshot from INDMoney US stocks page. Extract each US stock/ETF with these fields:
- ticker (US market symbol like AAPL, MSFT, PPLT, CPER)
- name (full company/ETF name)
- quantity (number of shares, can be fractional)
- avgBuyPrice (average buy price in USD)
Note: Values are in USD.`,

    mutualfund: `You are analyzing a mutual fund statement/screenshot from an AMC website (could be PPFAS, Axis, Bandhan, Motilal Oswal, or HDFC). Extract each scheme with:
- name (full scheme name, e.g., "Parag Parikh Flexi Cap Fund - Direct Growth")
- quantity (number of units, can be decimal)
- avgBuyPrice (NAV at purchase or average NAV)
- amfiCode (AMFI scheme code if visible, otherwise null)
For ticker, use a short form of the scheme name.`,

    epf: `You are analyzing an EPF (Employee Provident Fund) passbook or statement from EPFO/UMANG. Extract:
- Total balance (employee + employer share)
- Total contribution amount
If multiple years are shown, provide the latest total.`,

    generic: `You are analyzing an investment portfolio screenshot. Identify the platform and extract each instrument with:
- ticker (stock symbol)
- name (full name)
- quantity (number of shares/units)
- avgBuyPrice (average buy price)
Also identify what type of instrument each is (Indian stock, US stock, mutual fund, ETF, SGB, etc.)`,
};

function detectInstrumentType(ticker: string, name: string, platform: string): InstrumentType {
    const t = ticker.toUpperCase();
    const n = name.toUpperCase();

    if (platform === 'indmoney') {
        if (t === 'PPLT' || n.includes('PLATINUM')) return 'PLATINUM_ETF';
        if (t === 'CPER' || n.includes('COPPER')) return 'COPPER_ETF';
        return 'STOCK_US';
    }

    if (t.includes('GOLDBEES') || t.includes('GOLD ETF') || n.includes('GOLD ETF')) return 'GOLD_ETF';
    if (t.includes('SILVERBEES') || t.includes('SILVER') || n.includes('SILVER ETF')) return 'SILVER_ETF';
    if (t.startsWith('SGB') || n.includes('SOVEREIGN GOLD')) return 'SGB';
    if (platform === 'mutualfund') return 'MUTUAL_FUND';
    if (platform === 'epf') return 'EPF';

    return 'STOCK_IN';
}

interface GeminiExtractedItem {
    ticker: string;
    name: string;
    quantity: number;
    avgBuyPrice: number;
    amfiCode?: string | null;
}

export async function parseWithGemini(
    imageBase64: string,
    mimeType: string,
    platform: string,
    apiKey: string
): Promise<ManualAddPayload[]> {
    const prompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.generic;

    const requestBody = {
        contents: [{
            parts: [
                {
                    inlineData: {
                        mimeType,
                        data: imageBase64,
                    },
                },
                {
                    text: `${prompt}

IMPORTANT: Respond ONLY with a valid JSON array. Each element must have these exact fields:
{
  "ticker": "string",
  "name": "string",
  "quantity": number,
  "avgBuyPrice": number,
  "amfiCode": "string or null"
}

If the image is not a portfolio/holdings screenshot, respond with an empty array [].
Do NOT include markdown formatting, code blocks, or any text outside the JSON array.`,
                },
            ],
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
        },
    };

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        }
    );

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Gemini API error: ${res.status} - ${error}`);
    }

    const data = await res.json();
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
        throw new Error('No content returned from Gemini');
    }

    // Parse the JSON response, handling possible markdown code blocks
    let cleanedText = textContent.trim();
    if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let extracted: GeminiExtractedItem[];
    try {
        extracted = JSON.parse(cleanedText);
    } catch {
        console.error('Failed to parse Gemini response:', cleanedText);
        throw new Error('Failed to parse extracted data. The screenshot may not be in a recognized format.');
    }

    if (!Array.isArray(extracted)) {
        throw new Error('Unexpected response format from Gemini');
    }

    // Convert to ManualAddPayload
    return extracted.map((item) => {
        const type = detectInstrumentType(item.ticker, item.name, platform);
        const category: InstrumentCategory = TYPE_TO_CATEGORY[type];
        const commodityType: CommodityType = TYPE_TO_COMMODITY[type] ?? null;
        const currency = (type === 'STOCK_US' || type === 'PLATINUM_ETF' || type === 'COPPER_ETF') ? 'USD' as const : 'INR' as const;
        const exchange: Exchange = currency === 'USD' ? 'NYSE' : (type === 'MUTUAL_FUND' ? 'AMFI' : 'NSE');

        return {
            ticker: item.ticker.toUpperCase(),
            name: item.name,
            type,
            category,
            commodityType,
            quantity: item.quantity,
            avgBuyPrice: item.avgBuyPrice,
            buyDate: null,
            exchange,
            amfiCode: item.amfiCode || null,
            currency,
            notes: `Imported from ${platform}`,
        };
    });
}

export function parseCSV(csvContent: string): ManualAddPayload[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const instruments: ManualAddPayload[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });

        const ticker = row['ticker'] || row['symbol'] || row['scrip'] || '';
        const name = row['name'] || row['company'] || row['instrument'] || ticker;
        const qty = parseFloat(row['quantity'] || row['qty'] || row['units'] || '0');
        const avgPrice = parseFloat(row['avg_price'] || row['avgprice'] || row['average_price'] || row['buy_price'] || '0');

        if (!ticker || qty === 0) continue;

        const type: InstrumentType = 'STOCK_IN'; // default, user can change
        instruments.push({
            ticker: ticker.toUpperCase(),
            name,
            type,
            category: 'INDIAN_EQ',
            commodityType: null,
            quantity: qty,
            avgBuyPrice: avgPrice,
            buyDate: row['date'] || row['buy_date'] || null,
            exchange: 'NSE',
            amfiCode: null,
            currency: 'INR',
            notes: 'Imported from CSV',
        });
    }

    return instruments;
}
