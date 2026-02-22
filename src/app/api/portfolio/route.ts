import { NextRequest, NextResponse } from 'next/server';
import { getAllInstruments, addInstrument, updateInstrument, deleteInstrument, getInstrumentByTicker, findDuplicates } from '@/lib/db';
import { ManualAddPayload, Instrument, TYPE_TO_CATEGORY, TYPE_TO_COMMODITY } from '@/types';
import { randomUUID } from 'crypto';

export async function GET() {
    try {
        const instruments = getAllInstruments();
        return NextResponse.json(instruments);
    } catch (error) {
        console.error('GET /api/portfolio error:', error);
        return NextResponse.json({ error: 'Failed to fetch instruments' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: ManualAddPayload = await request.json();

        // Check for duplicates
        const duplicates = findDuplicates(body.ticker, body.name);
        if (duplicates.length > 0) {
            return NextResponse.json({
                error: 'duplicate',
                message: `Instrument "${body.ticker}" already exists`,
                existing: duplicates[0],
                new: body,
            }, { status: 409 });
        }

        const instrument: Instrument = {
            id: randomUUID(),
            ...body,
            investedAmount: body.quantity * body.avgBuyPrice,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        addInstrument(instrument);
        return NextResponse.json(instrument, { status: 201 });
    } catch (error) {
        console.error('POST /api/portfolio error:', error);
        return NextResponse.json({ error: 'Failed to add instrument' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        if (updates.quantity && updates.avgBuyPrice) {
            updates.investedAmount = updates.quantity * updates.avgBuyPrice;
        }

        const updated = updateInstrument(id, updates);
        if (!updated) {
            return NextResponse.json({ error: 'Instrument not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('PUT /api/portfolio error:', error);
        return NextResponse.json({ error: 'Failed to update instrument' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const deleted = deleteInstrument(id);
        if (!deleted) {
            return NextResponse.json({ error: 'Instrument not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/portfolio error:', error);
        return NextResponse.json({ error: 'Failed to delete instrument' }, { status: 500 });
    }
}
