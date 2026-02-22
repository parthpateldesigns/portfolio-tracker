import { NextRequest, NextResponse } from 'next/server';
import { getAllInstruments } from '@/lib/db';
import { fetchAllPrices, fetchUSDINR, getMarketStatus } from '@/lib/price-engine';
import { InstrumentWithPrice, PortfolioSummary, CategoryBreakdown, CATEGORY_CONFIG, InstrumentCategory } from '@/types';

export async function GET(request: NextRequest) {
    try {
        const instruments = getAllInstruments();
        const prices = await fetchAllPrices(instruments);
        const usdToInr = await fetchUSDINR();
        const marketStatus = getMarketStatus();

        // Build instrument-with-price list
        const instrumentsWithPrices: InstrumentWithPrice[] = instruments.map((inst) => {
            const price = prices.get(inst.id);
            const currentPriceRaw = price?.currentPrice ?? inst.avgBuyPrice;
            const previousCloseRaw = price?.previousClose ?? currentPriceRaw;

            // Determine currency of the price source
            // If live price is available, use its currency (e.g. USD for US stocks)
            // If fallback to avgBuyPrice, use instrument currency (which we converted to INR)
            const priceCurrency = price?.currency ?? inst.currency;

            // Convert to INR if source is USD
            const priceInINR = priceCurrency === 'USD' ? currentPriceRaw * usdToInr : currentPriceRaw;
            const avgPriceInINR = inst.currency === 'USD' ? inst.avgBuyPrice * usdToInr : inst.avgBuyPrice;
            const prevCloseInINR = priceCurrency === 'USD' ? previousCloseRaw * usdToInr : previousCloseRaw;

            const currentValue = inst.quantity * priceInINR;
            const investedAmount = inst.quantity * avgPriceInINR;
            const totalPL = currentValue - investedAmount;
            const totalPLPercent = investedAmount > 0 ? (totalPL / investedAmount) * 100 : 0;

            const dayPL = inst.quantity * (priceInINR - prevCloseInINR);
            const dayPLPercent = prevCloseInINR > 0 ? ((priceInINR - prevCloseInINR) / prevCloseInINR) * 100 : 0;

            return {
                ...inst,
                currentPrice: priceInINR,
                currentValue,
                totalPL,
                totalPLPercent,
                dayPL,
                dayPLPercent,
                previousClose: prevCloseInINR,
                lastUpdated: price?.lastUpdated ?? new Date().toISOString(),
            };
        });

        // Calculate category breakdown
        const categoryMap = new Map<InstrumentCategory, { invested: number; current: number; dayPL: number }>();

        instrumentsWithPrices.forEach((inst) => {
            const existing = categoryMap.get(inst.category) || { invested: 0, current: 0, dayPL: 0 };
            existing.invested += inst.quantity * (inst.currency === 'USD' ? inst.avgBuyPrice * usdToInr : inst.avgBuyPrice);
            existing.current += inst.currentValue;
            existing.dayPL += inst.dayPL;
            categoryMap.set(inst.category, existing);
        });

        const totalInvested = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.invested, 0);
        const totalCurrent = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.current, 0);

        const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries()).map(([cat, vals]) => ({
            category: cat,
            label: CATEGORY_CONFIG[cat]?.label ?? cat,
            invested: vals.invested,
            current: vals.current,
            pl: vals.current - vals.invested,
            plPercent: vals.invested > 0 ? ((vals.current - vals.invested) / vals.invested) * 100 : 0,
            allocation: totalCurrent > 0 ? (vals.current / totalCurrent) * 100 : 0,
            color: CATEGORY_CONFIG[cat]?.color ?? '#888',
        }));

        const totalPL = totalCurrent - totalInvested;
        const dayPL = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.dayPL, 0);

        const summary: PortfolioSummary = {
            totalInvested,
            totalCurrent,
            totalPL,
            totalPLPercent: totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0,
            dayPL,
            dayPLPercent: totalCurrent > 0 ? (dayPL / (totalCurrent - dayPL)) * 100 : 0,
            categoryBreakdown,
            usdToInr,
        };

        return NextResponse.json({
            instruments: instrumentsWithPrices,
            summary,
            marketStatus,
            lastUpdated: new Date().toISOString(),
        });
    } catch (error) {
        console.error('GET /api/prices error:', error);
        return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
    }
}
