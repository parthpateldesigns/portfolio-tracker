"use client";

import React, { useState } from "react";
import { HOLDINGS, Holding, COMMODITY_META, USD_INR } from "./data";
import { HoldingsTable, SectionHeader, StatCard, fmtINR, pnl, pnlPct, PnlPill } from "./components";

// ── Cross-list reference banner ────────────────────────────────────────────────
function CrossListBanner({ label, targetTab }: { label: string; targetTab: string }) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: "var(--bg-elevated)", border: "1px dashed var(--border)",
            borderRadius: "var(--radius-md)", marginBottom: 14, fontSize: 13,
        }}>
            <span style={{ fontSize: 16 }}>🔗</span>
            <span style={{ color: "var(--text-secondary)" }}>
                {label} — shown here for convenience.{" "}
                <strong style={{ color: "var(--text-primary)" }}>Counted under {targetTab}</strong>{" "}
                segment — not included in this tab's P&L totals.
            </span>
        </div>
    );
}

// ── IND Stocks Tab ─────────────────────────────────────────────────────────────
export function IndStocksView({ holdings }: { holdings: Holding[] }) {
    const stocks = holdings.filter(h => h.type !== "REIT");
    const reits = holdings.filter(h => h.type === "REIT");
    // Cross-listed from Commodities (Zerodha Kite, INR instruments)
    const kiteComm = HOLDINGS.filter(h => h.segment === "commodities" && h.displayInTabs?.includes("ind_stocks"));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
                <SectionHeader title="Indian Equities" count={stocks.length} color="#4f8ef7" />
                <HoldingsTable holdings={stocks} />
            </div>
            {reits.length > 0 && (
                <div>
                    <SectionHeader title="REITs" count={reits.length} color="#9b7bff" />
                    <HoldingsTable holdings={reits} />
                </div>
            )}
            {kiteComm.length > 0 && (
                <div>
                    <SectionHeader title="Commodity ETFs & SGBs (Zerodha Kite)" count={kiteComm.length} color="#c9a84c" />
                    <CrossListBanner label="Gold ETF, Silver ETF & SGB purchased through Zerodha Kite" targetTab="Commodities" />
                    <HoldingsTable holdings={kiteComm} />
                </div>
            )}
        </div>
    );
}

// ── US Stocks Tab ──────────────────────────────────────────────────────────────
export function USStocksView({ holdings }: { holdings: Holding[] }) {
    const [showUSD, setShowUSD] = useState(false);
    // Cross-listed from Commodities (Indmoney, USD instruments)
    const indmoneyComm = HOLDINGS.filter(h => h.segment === "commodities" && h.displayInTabs?.includes("us_stocks"));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "8px 14px" }}>
                    💡 All values in <strong style={{ color: "var(--text-primary)" }}>INR</strong> by default &nbsp;·&nbsp; 1 USD = ₹{USD_INR}
                </div>
                <button
                    onClick={() => setShowUSD(v => !v)}
                    style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                        borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
                        background: showUSD ? "rgba(155,123,255,0.12)" : "var(--bg-elevated)",
                        color: showUSD ? "#9b7bff" : "var(--text-secondary)",
                        fontSize: 13, fontWeight: 500, transition: "all 0.15s",
                    }}
                >
                    <span style={{ fontSize: 16 }}>{showUSD ? "🇺🇸" : "🇮🇳"}</span>
                    {showUSD ? "Showing USD" : "Showing INR"}
                </button>
            </div>
            <div>
                <SectionHeader title="US Equities" count={holdings.length} color="#9b7bff" />
                <HoldingsTable holdings={holdings} showUSD={showUSD} />
            </div>
            {indmoneyComm.length > 0 && (
                <div>
                    <SectionHeader title="Commodity ETFs (Indmoney)" count={indmoneyComm.length} color="#c9a84c" />
                    <CrossListBanner label="Platinum & Copper ETF purchased via Indmoney (USD)" targetTab="Commodities" />
                    <HoldingsTable holdings={indmoneyComm} showUSD={showUSD} />
                </div>
            )}
        </div>
    );
}

// ── Mutual Funds Tab ───────────────────────────────────────────────────────────
export function MutualFundsView({ holdings }: { holdings: Holding[] }) {
    return <HoldingsTable holdings={holdings} showQty={false} />;
}

// ── EPF Tab ────────────────────────────────────────────────────────────────────
export function EPFView({ holdings }: { holdings: Holding[] }) {
    const h = holdings[0];
    if (!h) return <div style={{ color: "var(--text-secondary)" }}>No EPF data.</div>;
    const gain = pnl(h.currentINR, h.investedINR);
    const gPct = pnlPct(h.currentINR, h.investedINR);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <StatCard label="Total Contributed" value={fmtINR(h.investedINR)} />
                <StatCard label="Current Balance" value={fmtINR(h.currentINR)} />
                <StatCard label="Interest Earned" value={fmtINR(gain)} positive sub={`+${gPct.toFixed(2)}% returns`} />
                <StatCard label="Interest Rate" value="8.25% p.a." color="var(--accent-green)" />
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>Breakdown · EPFO</div>
                {[
                    { label: "Employee Contribution", value: fmtINR(h.investedINR * 0.5) },
                    { label: "Employer Contribution", value: fmtINR(h.investedINR * 0.5) },
                    { label: "Accrued Interest", value: fmtINR(gain) },
                ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", padding: "10px 0", fontSize: 14 }}>
                        <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                        <span style={{ fontWeight: 600 }}>{r.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── PPF Tab ────────────────────────────────────────────────────────────────────
export function PPFView({ holdings }: { holdings: Holding[] }) {
    const h = holdings[0];
    if (!h) return <div style={{ color: "var(--text-secondary)" }}>No PPF data.</div>;
    const gain = pnl(h.currentINR, h.investedINR);
    const gPct = pnlPct(h.currentINR, h.investedINR);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <StatCard label="Total Deposited" value={fmtINR(h.investedINR)} />
                <StatCard label="Current Balance" value={fmtINR(h.currentINR)} />
                <StatCard label="Interest Earned" value={fmtINR(gain)} positive sub={`+${gPct.toFixed(2)}% returns`} />
                <StatCard label="Interest Rate" value="7.10% p.a." color="var(--accent-yellow)" />
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Public Provident Fund · SBI</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Tax-free returns under Sec 80C · 15-year lock-in</div>
                <div style={{ display: "flex", gap: 8 }}>
                    {[
                        { label: "EEE Tax Status", bg: "rgba(212,160,48,0.1)", color: "#d4a030", border: "rgba(212,160,48,0.2)" },
                        { label: "Active", bg: "rgba(39,195,123,0.08)", color: "var(--accent-green)", border: "rgba(39,195,123,0.15)" },
                    ].map(b => (
                        <span key={b.label} style={{ fontSize: 12, padding: "4px 10px", background: b.bg, color: b.color, border: `1px solid ${b.border}`, borderRadius: 20 }}>{b.label}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Commodities Tab ────────────────────────────────────────────────────────────
export function CommoditiesView({ holdings }: { holdings: Holding[] }) {
    const groups = [
        { key: "gold", items: holdings.filter(h => h.subType === "gold") },
        { key: "silver", items: holdings.filter(h => h.subType === "silver") },
        { key: "platinum", items: holdings.filter(h => h.subType === "platinum") },
        { key: "copper", items: holdings.filter(h => h.subType === "copper") },
    ].filter(g => g.items.length > 0);

    const totalInv = holdings.reduce((s, h) => s + h.investedINR, 0);
    const totalCur = holdings.reduce((s, h) => s + h.currentINR, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {/* Total Summary */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "22px 26px", boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 10 }}>
                    🪙 Total Commodities
                </div>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div>
                        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmtINR(totalCur)}</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Current Value</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>{fmtINR(totalInv)}</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Invested</div>
                    </div>
                    <PnlPill cur={totalCur} inv={totalInv} />
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
                    {groups.map(g => {
                        const meta = COMMODITY_META[g.key];
                        const gCur = g.items.reduce((s, h) => s + h.currentINR, 0);
                        const pct = totalCur > 0 ? (gCur / totalCur * 100).toFixed(1) : "0";
                        return (
                            <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color }} />
                                <span style={{ color: "var(--text-secondary)" }}>{meta.label}</span>
                                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmtINR(gCur, true)}</span>
                                <span style={{ color: "var(--text-muted)" }}>({pct}%)</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Per-group tables */}
            {groups.map(g => {
                const meta = COMMODITY_META[g.key];
                const isUSD = g.items[0]?.currency === "USD";
                const brokers = [...new Set(g.items.map(h => h.broker).filter(Boolean))].join(", ");
                return (
                    <div key={g.key}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color }} />
                            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{meta.label}</h3>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: 20 }}>{brokers}</span>
                            {isUSD && <span style={{ fontSize: 11, color: "#9b7bff", background: "rgba(155,123,255,0.1)", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>USD → ₹{USD_INR}</span>}
                        </div>
                        <HoldingsTable holdings={g.items} />
                    </div>
                );
            })}
        </div>
    );
}
