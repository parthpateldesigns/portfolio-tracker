"use client";
import React from "react";
import { Holding, USD_INR } from "./data";

// ── Formatters ─────────────────────────────────────────────────────────────────
export const fmtINR = (n: number, compact = false) => {
    if (compact) {
        if (Math.abs(n) >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
        if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
        if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(1)} K`;
        return `₹${n.toFixed(0)}`;
    }
    return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};
export const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
export const pnl = (cur: number, inv: number) => cur - inv;
export const pnlPct = (cur: number, inv: number) => inv === 0 ? 0 : ((cur - inv) / inv) * 100;

// ── Stat Card ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, positive, color }: {
    label: string; value: string; sub?: string; positive?: boolean; color?: string;
}) {
    return (
        <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: "20px 22px",
            boxShadow: "var(--shadow)",
        }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--text-primary)", letterSpacing: "-0.02em" }}>
                {value}
            </div>
            {sub && (
                <div style={{ fontSize: 13, marginTop: 4, fontWeight: 500, color: positive === undefined ? "var(--text-secondary)" : positive ? "var(--accent-green)" : "var(--accent-red)" }}>
                    {sub}
                </div>
            )}
        </div>
    );
}

// ── Pie Tooltip ────────────────────────────────────────────────────────────────
export function PieTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, boxShadow: "var(--shadow-lg)" }}>
            <div style={{ color: d.payload.color, fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
            <div style={{ color: "var(--text-primary)" }}>{fmtINR(d.value)}</div>
            <div style={{ color: "var(--text-secondary)" }}>{d.payload.percent?.toFixed(1)}%</div>
        </div>
    );
}

// ── Holding Row ────────────────────────────────────────────────────────────────
export function HoldingRow({ h, rank, showUSD = false }: { h: Holding; rank?: number; showUSD?: boolean }) {
    const cur = h.currentINR;
    const inv = h.investedINR;
    const gain = pnl(cur, inv);
    const gainPct = pnlPct(cur, inv);
    const isPos = gain >= 0;

    const displayPrice = showUSD && h.currency === "USD"
        ? (v: number | undefined, vUSD: number | undefined) => vUSD != null ? fmtUSD(vUSD) : "—"
        : (v: number | undefined) => v != null ? fmtINR(v) : "—";

    const displayCur = showUSD && h.currency === "USD" ? fmtUSD(cur / USD_INR) : fmtINR(cur, true);
    const displayInv = showUSD && h.currency === "USD" ? fmtUSD(inv / USD_INR) : fmtINR(inv, true);

    return (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.12s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
        >
            {rank != null && (
                <td style={{ padding: "11px 14px", color: "var(--text-muted)", fontSize: 12, width: 36 }}>{rank}</td>
            )}
            <td style={{ padding: "11px 14px" }}>
                <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                    {h.name}
                    {h.note && <span style={{ fontSize: 11, color: "var(--accent-red)", background: "var(--accent-red-dim)", padding: "1px 6px", borderRadius: 4 }}>{h.note}</span>}
                    {h.currency === "USD" && <span style={{ fontSize: 10, color: "#9b7bff", background: "rgba(155,123,255,0.1)", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>USD</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {h.ticker && <span style={{ fontFamily: "monospace", marginRight: 8 }}>{h.ticker}</span>}
                    <span style={{ color: "var(--text-tertiary)" }}>{h.type}</span>
                    {h.broker && <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>· {h.broker}</span>}
                </div>
            </td>
            {h.qty != null && (
                <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>
                    {h.qty % 1 !== 0 ? h.qty.toFixed(2) : h.qty}
                </td>
            )}
            {h.avgPriceINR != null || h.avgPriceUSD != null ? (
                <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>
                    {showUSD && h.avgPriceUSD != null ? fmtUSD(h.avgPriceUSD) : h.avgPriceINR != null ? fmtINR(h.avgPriceINR) : "—"}
                </td>
            ) : null}
            {h.currentPriceINR != null || h.currentPriceUSD != null ? (
                <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: (h.currentPriceINR === 0 || h.currentPriceUSD === 0) ? "var(--text-muted)" : "var(--text-primary)" }}>
                    {showUSD && h.currentPriceUSD != null ? (h.currentPriceUSD === 0 ? "—" : fmtUSD(h.currentPriceUSD)) : h.currentPriceINR != null ? (h.currentPriceINR === 0 ? "—" : fmtINR(h.currentPriceINR)) : "—"}
                </td>
            ) : null}
            <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>{displayInv}</td>
            <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: cur === 0 ? "var(--text-muted)" : "var(--text-primary)" }}>
                {cur === 0 ? "—" : displayCur}
            </td>
            <td style={{ padding: "11px 14px", textAlign: "right" }}>
                {cur > 0 ? (
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isPos ? "var(--accent-green)" : "var(--accent-red)" }}>
                            {isPos ? "+" : ""}{fmtINR(gain, true)}
                        </div>
                        <div style={{ fontSize: 12, color: isPos ? "var(--accent-green)" : "var(--accent-red)", opacity: 0.8 }}>
                            {isPos ? "+" : ""}{gainPct.toFixed(2)}%
                        </div>
                    </div>
                ) : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>}
            </td>
        </tr>
    );
}

// ── Holdings Table ─────────────────────────────────────────────────────────────
export function HoldingsTable({ holdings, showQty = true, showUSD = false }: {
    holdings: Holding[]; showQty?: boolean; showUSD?: boolean;
}) {
    const inv = holdings.reduce((s, h) => s + h.investedINR, 0);
    const cur = holdings.reduce((s, h) => s + h.currentINR, 0);
    const gain = cur - inv;
    const gPct = pnlPct(cur, inv);
    const isPos = gain >= 0;
    const hasQty = showQty && holdings.some(h => h.qty != null);
    const hasPrice = holdings.some(h => h.avgPriceINR != null || h.avgPriceUSD != null);

    return (
        <div>
            <div style={{ display: "flex", gap: 24, padding: "14px 0", flexWrap: "wrap" }}>
                {[
                    { label: "Invested", val: fmtINR(inv) },
                    { label: "Current", val: fmtINR(cur) },
                ].map(x => (
                    <span key={x.label} style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {x.label}: <strong style={{ color: "var(--text-primary)" }}>{x.val}</strong>
                    </span>
                ))}
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    P&L:{" "}
                    <strong style={{ color: isPos ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {isPos ? "+" : ""}{fmtINR(gain)} ({isPos ? "+" : ""}{gPct.toFixed(2)}%)
                    </strong>
                </span>
            </div>
            <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                            {["#", "Name", ...(hasQty ? ["Qty", "Avg", "LTP"] : []), "Invested", "Current", "P&L"]
                                .map(h => (
                                    <th key={h} style={{ padding: "10px 14px", textAlign: h === "#" || h === "Name" ? "left" : "right", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        {h === "Avg" && showUSD ? `Avg (${showUSD ? "USD" : "INR"})` : h === "LTP" && showUSD ? "LTP (USD)" : h}
                                    </th>
                                ))}
                        </tr>
                    </thead>
                    <tbody>
                        {holdings.map((h, i) => (
                            <HoldingRow key={h.id} h={h} rank={i + 1} showUSD={showUSD} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Section Header ──────────────────────────────────────────────────────────────
export function SectionHeader({ title, count, color }: { title: string; count?: number; color?: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            {color && <div style={{ width: 3, height: 18, borderRadius: 2, background: color }} />}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
            {count != null && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: 20 }}>{count}</span>
            )}
        </div>
    );
}

// ── Summary Pill ───────────────────────────────────────────────────────────────
export function PnlPill({ cur, inv }: { cur: number; inv: number }) {
    const g = pnl(cur, inv);
    const gp = pnlPct(cur, inv);
    const isPos = g >= 0;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 13, fontWeight: 600,
            color: isPos ? "var(--accent-green)" : "var(--accent-red)",
            background: isPos ? "var(--accent-green-dim)" : "var(--accent-red-dim)",
            padding: "3px 10px", borderRadius: 20,
        }}>
            {isPos ? "▲" : "▼"} {fmtINR(Math.abs(g), true)} ({Math.abs(gp).toFixed(2)}%)
        </span>
    );
}
