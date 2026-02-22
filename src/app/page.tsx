"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { HOLDINGS, SEGMENT_META, COMMODITY_META, Segment } from "./data";
import { fmtINR, pnlPct, PieTooltip, PnlPill } from "./components";
import { IndStocksView, USStocksView, MutualFundsView, EPFView, PPFView, CommoditiesView } from "./tabs";

// ── Types ──────────────────────────────────────────────────────────────────────
interface MarketStatus { indianMarketOpen: boolean; usMarketOpen: boolean; nextRefreshIn: number; }
interface LiveData { summary?: { totalInvested: number; totalCurrent: number; totalPL: number; totalPLPercent: number; dayPL: number; dayPLPercent: number; usdToInr: number; }; marketStatus?: MarketStatus; lastUpdated?: string; error?: string; }

// ── Market Status Badge ────────────────────────────────────────────────────────
function MarketBadge({ status }: { status: MarketStatus | undefined }) {
  if (!status) return null;
  const { indianMarketOpen, usMarketOpen } = status;
  const both = indianMarketOpen && usMarketOpen;
  const none = !indianMarketOpen && !usMarketOpen;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500,
        padding: "4px 10px", borderRadius: 20,
        background: indianMarketOpen ? "rgba(39,195,123,0.1)" : "rgba(90,100,128,0.15)",
        color: indianMarketOpen ? "var(--accent-green)" : "var(--text-muted)",
        border: `1px solid ${indianMarketOpen ? "rgba(39,195,123,0.25)" : "var(--border)"}`,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", animation: indianMarketOpen ? "pulse 2s infinite" : "none" }} />
        🇮🇳 {indianMarketOpen ? "Open" : "Closed"}
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500,
        padding: "4px 10px", borderRadius: 20,
        background: usMarketOpen ? "rgba(155,123,255,0.1)" : "rgba(90,100,128,0.15)",
        color: usMarketOpen ? "#9b7bff" : "var(--text-muted)",
        border: `1px solid ${usMarketOpen ? "rgba(155,123,255,0.25)" : "var(--border)"}`,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", animation: usMarketOpen ? "pulse 2s infinite" : "none" }} />
        🇺🇸 {usMarketOpen ? "Open" : "Closed"}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Live Data Hook ─────────────────────────────────────────────────────────────
function useLiveData() {
  const [data, setData] = useState<LiveData>({});
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prices");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastFetched(new Date().toLocaleTimeString("en-IN"));
    } catch (e: any) {
      setData(prev => ({ ...prev, error: e.message }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const market = data.marketStatus;
    const interval = market?.nextRefreshIn ?? 60000;
    const timer = setInterval(fetch_, interval);
    return () => clearInterval(timer);
  }, [data.marketStatus?.nextRefreshIn]);

  return { data, loading, lastFetched, refresh: fetch_ };
}

// ── Historical Graph (localStorage snapshots) ──────────────────────────────────
function HistoryChart({ totalInv, totalCur }: { totalInv: number; totalCur: number }) {
  const [points, setPoints] = useState<{ date: string; invested: number; current: number }[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("portfolio_snapshots") || "[]");
      // Append today's snapshot (dedup by date)
      const today = new Date().toISOString().split("T")[0];
      const filtered = stored.filter((p: any) => p.date !== today);
      const updated = [...filtered, { date: today, invested: Math.round(totalInv), current: Math.round(totalCur) }].slice(-90);
      localStorage.setItem("portfolio_snapshots", JSON.stringify(updated));
      setPoints(updated);
    } catch { }
  }, [totalInv, totalCur]);

  if (points.length < 2) return (
    <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
      Historical graph will appear after 2+ days of data. Come back tomorrow! 📈
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={v => fmtINR(v, true)} width={72} />
        <Tooltip formatter={(v: number, name: string) => [fmtINR(v), name === "invested" ? "Invested" : "Current"]}
          contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }} />
        <Line type="monotone" dataKey="invested" stroke="#4f8ef7" strokeWidth={2} dot={false} name="Invested" />
        <Line type="monotone" dataKey="current" stroke="#27c37b" strokeWidth={2} dot={false} name="Current" />
        <Legend formatter={v => <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v === "invested" ? "Invested" : "Current Value"}</span>} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function Dashboard({ onNav, live, loading, lastFetched }: {
  onNav: (s: Segment) => void;
  live: LiveData; loading: boolean; lastFetched: string | null;
}) {
  const all = HOLDINGS;
  // Use live API data if available, else fallback to static dummy
  const totalInv = live.summary?.totalInvested ?? all.reduce((s, h) => s + h.investedINR, 0);
  const totalCur = live.summary?.totalCurrent ?? all.reduce((s, h) => s + h.currentINR, 0);
  const usdInr = live.summary?.usdToInr ?? 83.5;

  const segData = useMemo(() => {
    const map: Record<string, { inv: number; cur: number }> = {};
    for (const h of all) {
      if (!map[h.segment]) map[h.segment] = { inv: 0, cur: 0 };
      map[h.segment].inv += h.investedINR;
      map[h.segment].cur += h.currentINR;
    }
    return Object.entries(map).map(([seg, d]) => ({
      seg, ...d, ...SEGMENT_META[seg],
      pct: totalCur > 0 ? (d.cur / totalCur) * 100 : 0,
    }));
  }, [all, totalCur]);

  const commHoldings = all.filter(h => h.segment === "commodities");
  const commSub = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of commHoldings) {
      const k = h.subType || "other";
      map[k] = (map[k] || 0) + h.currentINR;
    }
    return Object.entries(map).map(([k, v]) => ({
      name: COMMODITY_META[k]?.label || k, value: v,
      color: COMMODITY_META[k]?.color || "#888",
    }));
  }, [commHoldings]);

  const pieData = segData.map(s => ({ name: s.label, value: s.cur, color: s.color, percent: s.pct }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "28px 32px", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>
              Total Portfolio Value
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
              {fmtINR(totalCur)}
              {loading && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>updating…</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Invested: <strong style={{ color: "var(--text-primary)" }}>{fmtINR(totalInv, true)}</strong>
              </span>
              <PnlPill cur={totalCur} inv={totalInv} />
              {live.summary && (
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Today:{" "}
                  <strong style={{ color: live.summary.dayPL >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                    {live.summary.dayPL >= 0 ? "+" : ""}{fmtINR(live.summary.dayPL, true)} ({live.summary.dayPLPercent.toFixed(2)}%)
                  </strong>
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <MarketBadge status={live.marketStatus} />
            {lastFetched && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Updated {lastFetched}</div>}
            {usdInr !== 83.5 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>1 USD = ₹{usdInr.toFixed(2)}</div>}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        {/* Allocation pie */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "22px 20px", boxShadow: "var(--shadow)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Portfolio Allocation</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>By Segment (Current Value)</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={95} paddingAngle={2} dataKey="value">
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              {pieData.map(d => (
                <button key={d.name} onClick={() => onNav(segData.find(s => s.label === d.name)!.seg as Segment)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "none"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{d.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fmtINR(d.value, true)}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", width: 42, textAlign: "right" }}>{d.percent?.toFixed(1)}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "22px 20px", boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Commodities</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>Gold · Silver · Platinum · Copper</div>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={commSub} cx="50%" cy="50%" outerRadius={52} paddingAngle={2} dataKey="value">
                  {commSub.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
              {commSub.map(d => (
                <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: d.color }} />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{fmtINR(d.value, true)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "20px 22px", boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Overall P&L</div>
            {[
              { label: "Invested", value: fmtINR(totalInv) },
              { label: "Current", value: fmtINR(totalCur) },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 14 }}>
                <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                <span style={{ fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontSize: 14 }}>
              <span style={{ color: "var(--text-secondary)" }}>Unrealised P&L</span>
              <PnlPill cur={totalCur} inv={totalInv} />
            </div>
          </div>
        </div>
      </div>

      {/* Historical chart */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "22px 24px", boxShadow: "var(--shadow)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Portfolio History</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>Daily snapshot — Invested vs Current (last 90 days)</div>
        <HistoryChart totalInv={totalInv} totalCur={totalCur} />
      </div>

      {/* Segment grid */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>All Segments</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
          {segData.map(s => {
            const g = s.cur - s.inv;
            const gp = pnlPct(s.cur, s.inv);
            return (
              <button key={s.seg} onClick={() => onNav(s.seg as Segment)}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderLeft: `3px solid ${s.color}`, borderRadius: "var(--radius-md)", padding: "14px 16px", textAlign: "left", transition: "background 0.12s", boxShadow: "var(--shadow)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-card)"}
              >
                <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{s.icon} {s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>{fmtINR(s.cur, true)}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: g >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 600 }}>{g >= 0 ? "▲" : "▼"} {Math.abs(gp).toFixed(2)}%</span>
                  <span style={{ fontSize: 11, color: s.color, background: `${s.color}18`, padding: "1px 7px", borderRadius: 20, fontWeight: 600 }}>{s.pct.toFixed(1)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Nav tabs ───────────────────────────────────────────────────────────────────
const TABS: { id: Segment; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "ind_stocks", label: "IND Stocks", icon: "🇮🇳" },
  { id: "us_stocks", label: "US Stocks", icon: "🇺🇸" },
  { id: "mutual_funds", label: "Mutual Funds", icon: "📊" },
  { id: "epf", label: "EPF", icon: "🏛" },
  { id: "ppf", label: "PPF", icon: "🏦" },
  { id: "commodities", label: "Commodities", icon: "🪙" },
];

function ThemeToggle({ theme, onToggle }: { theme: "dark" | "light"; onToggle: () => void }) {
  return (
    <button onClick={onToggle} title="Toggle theme" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, transition: "all 0.15s" }}>
      {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Segment>("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { data: live, loading, lastFetched, refresh } = useLiveData();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const bySegment = useMemo(() => {
    const map: Record<string, typeof HOLDINGS> = {};
    for (const h of HOLDINGS) {
      if (!map[h.segment]) map[h.segment] = [];
      map[h.segment].push(h);
    }
    return map;
  }, []);

  const totalCur = HOLDINGS.reduce((s, h) => s + h.currentINR, 0);
  const totalInv = HOLDINGS.reduce((s, h) => s + h.investedINR, 0);
  const gain = totalCur - totalInv;
  const isPos = gain >= 0;
  const tabSegColor = SEGMENT_META[tab]?.color;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: theme === "dark" ? "rgba(19,23,32,0.96)" : "rgba(255,255,255,0.96)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, background: "var(--accent-blue)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff" }}>P</div>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Portfolio</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 20 }}>Demo</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, display: "flex", gap: 14, alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)" }}>Value <strong style={{ color: "var(--text-primary)" }}>{fmtINR(totalCur, true)}</strong></span>
                <span style={{ fontWeight: 600, color: isPos ? "var(--accent-green)" : "var(--accent-red)", fontSize: 13 }}>{isPos ? "▲" : "▼"} {fmtINR(Math.abs(gain), true)}</span>
              </div>
              <div style={{ width: 1, height: 20, background: "var(--border)" }} />
              <button onClick={refresh} disabled={loading} title="Refresh prices"
                style={{ padding: "6px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: loading ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 16, transition: "all 0.15s", cursor: loading ? "default" : "pointer" }}>
                {loading ? "⟳" : "↻"}
              </button>
              <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === "dark" ? "light" : "dark")} />
            </div>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", position: "sticky", top: 56, zIndex: 90 }}>
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", overflowX: "auto" }}>
            {TABS.map(t => {
              const isActive = tab === t.id;
              const segCur = (bySegment[t.id] || []).reduce((s, h) => s + h.currentINR, 0);
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "13px 18px", fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? "var(--text-primary)" : "var(--text-secondary)", borderBottom: isActive ? `2px solid ${SEGMENT_META[t.id]?.color || "var(--accent-blue)"}` : "2px solid transparent", background: isActive ? "var(--bg-tab-active)" : "transparent", whiteSpace: "nowrap", transition: "color 0.12s, background 0.12s" }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  {t.id !== "dashboard" && segCur > 0 && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 2 }}>{fmtINR(segCur, true)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 24px 72px" }}>
        {tab !== "dashboard" && (
          <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            {tabSegColor && <div style={{ width: 4, height: 22, borderRadius: 2, background: tabSegColor }} />}
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>{TABS.find(t => t.id === tab)?.label}</h1>
          </div>
        )}
        {tab === "dashboard" && <Dashboard onNav={setTab} live={live} loading={loading} lastFetched={lastFetched} />}
        {tab === "ind_stocks" && <IndStocksView holdings={bySegment["ind_stocks"] || []} />}
        {tab === "us_stocks" && <USStocksView holdings={bySegment["us_stocks"] || []} />}
        {tab === "mutual_funds" && <MutualFundsView holdings={bySegment["mutual_funds"] || []} />}
        {tab === "epf" && <EPFView holdings={bySegment["epf"] || []} />}
        {tab === "ppf" && <PPFView holdings={bySegment["ppf"] || []} />}
        {tab === "commodities" && <CommoditiesView holdings={bySegment["commodities"] || []} />}
      </main>
    </div>
  );
}
