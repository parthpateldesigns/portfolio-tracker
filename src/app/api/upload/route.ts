import { NextRequest, NextResponse } from 'next/server';
import { parseWithGemini, parseCSV } from '@/lib/ocr-parser';
import { findDuplicates, addInstrument } from '@/lib/db';
import { Instrument, ManualAddPayload } from '@/types';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const platform = (formData.get('platform') as string) || 'generic';
        const apiKey = formData.get('apiKey') as string;
        const autoAdd = formData.get('autoAdd') === 'true';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API key is required' }, { status: 400 });
        }

        let extracted: ManualAddPayload[] = [];

        if (file.name.endsWith('.csv')) {
            const text = await file.text();
            extracted = parseCSV(text);
        } else {
            // Image or PDF - use Gemini Vision
            const buffer = await file.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const mimeType = file.type || 'image/png';
            extracted = await parseWithGemini(base64, mimeType, platform, apiKey);
        }

        // Check for duplicates
        const results: {
            added: Instrument[];
            duplicates: { new: ManualAddPayload; existing: Instrument }[];
            errors: string[];
        } = {
            added: [],
            duplicates: [],
            errors: [],
        };

        for (const item of extracted) {
            try {
                const dupes = findDuplicates(item.ticker, item.name);

                if (dupes.length > 0) {
                    results.duplicates.push({ new: item, existing: dupes[0] });
                    continue;
                }

                if (autoAdd) {
                    const instrument: Instrument = {
                        id: randomUUID(),
                        ...item,
                        investedAmount: item.quantity * item.avgBuyPrice,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };
                    addInstrument(instrument);
                    results.added.push(instrument);
                } else {
                    // Return for review without adding
                    results.added.push({
                        id: randomUUID(),
                        ...item,
                        investedAmount: item.quantity * item.avgBuyPrice,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                }
            } catch (err) {
                results.errors.push(`Failed to process ${item.ticker}: ${String(err)}`);
            }
        }

        return NextResponse.json({
            extracted: extracted.length,
            ...results,
            autoAdded: autoAdd,
        });
    } catch (error) {
        console.error('POST /api/upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process upload' },
            { status: 500 }
        );
    }
}
