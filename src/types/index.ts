// ===== Enums =====
export type InstrumentCategory = 'INDIAN_EQ' | 'US_EQ' | 'MUTUAL_FUNDS' | 'COMMODITIES' | 'REITS' | 'DEBT' | 'CRYPTO';

export type InstrumentType =
  | 'STOCK_IN'
  | 'STOCK_US'
  | 'MUTUAL_FUND'
  | 'GOLD_ETF'
  | 'SILVER_ETF'
  | 'SGB'
  | 'PLATINUM_ETF'
  | 'COPPER_ETF'
  | 'EPF'
  | 'PPF'
  | 'REIT'
  | 'CRYPTO';

export type CommodityType = 'GOLD' | 'SILVER' | 'PLATINUM' | 'COPPER' | null;

export type Exchange = 'NSE' | 'BSE' | 'NASDAQ' | 'NYSE' | 'AMFI' | null;

// ===== Core Models =====
export interface Instrument {
  id: string;
  ticker: string;
  name: string;
  type: InstrumentType;
  category: InstrumentCategory;
  commodityType: CommodityType;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string | null;
  investedAmount: number;
  exchange: Exchange;
  amfiCode: string | null;
  currency: 'INR' | 'USD';
  notes: string | null;
  broker?: string; // AngelOne, Zerodha, etc.
  createdAt: string;
  updatedAt: string;
}

export interface LivePrice {
  ticker: string;
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  lastUpdated: string;
  currency: 'INR' | 'USD';
}

export interface InstrumentWithPrice extends Instrument {
  currentPrice: number;
  currentValue: number;
  totalPL: number;
  totalPLPercent: number;
  dayPL: number;
  dayPLPercent: number;
  previousClose: number;
  lastUpdated: string;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrent: number;
  totalPL: number;
  totalPLPercent: number;
  dayPL: number;
  dayPLPercent: number;
  categoryBreakdown: CategoryBreakdown[];
  usdToInr: number;
}

export interface CategoryBreakdown {
  category: InstrumentCategory;
  label: string;
  invested: number;
  current: number;
  pl: number;
  plPercent: number;
  allocation: number; // percentage of total
  color: string;
}

// ===== API Types =====
export interface ManualAddPayload {
  ticker: string;
  name: string;
  type: InstrumentType;
  category: InstrumentCategory;
  commodityType: CommodityType;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string | null;
  exchange: Exchange;
  amfiCode: string | null;
  currency: 'INR' | 'USD';
  notes: string | null;
}

export interface OCRResult {
  instruments: ManualAddPayload[];
  rawText: string;
  confidence: number;
  platform: string;
  duplicates: DuplicateCheck[];
}

export interface DuplicateCheck {
  newInstrument: ManualAddPayload;
  existingInstrument: Instrument;
  action: 'skip' | 'update' | 'add';
}

export interface PortfolioSnapshot {
  id: string;
  date: string;
  totalInvested: number;
  totalCurrent: number;
  usdToInr: number;
  breakdown: Record<string, { invested: number; current: number }>;
}

// ===== UI State =====
export type ActiveTab = 'dashboard' | 'indian_eq' | 'us_eq' | 'mutual_funds' | 'commodities' | 'reits' | 'debt' | 'crypto';
export type CurrencyDisplay = 'INR' | 'USD';

export interface MarketStatus {
  indianMarketOpen: boolean;
  usMarketOpen: boolean;
  nextRefreshIn: number;
}

// ===== Config =====
export const CATEGORY_CONFIG: Record<InstrumentCategory, { label: string; color: string }> = {
  INDIAN_EQ: { label: 'Indian Equities', color: '#6366f1' },
  US_EQ: { label: 'US Equities', color: '#8b5cf6' },
  MUTUAL_FUNDS: { label: 'Mutual Funds', color: '#06b6d4' },
  COMMODITIES: { label: 'Commodities', color: '#f59e0b' },
  REITS: { label: 'REITs', color: '#ec4899' },
  DEBT: { label: 'Debt', color: '#10b981' },
  CRYPTO: { label: 'Crypto', color: '#f97316' },
};

export const COMMODITY_INSTRUMENTS: InstrumentType[] = [
  'GOLD_ETF', 'SILVER_ETF', 'SGB', 'PLATINUM_ETF', 'COPPER_ETF'
];

export const TYPE_TO_CATEGORY: Record<InstrumentType, InstrumentCategory> = {
  STOCK_IN: 'INDIAN_EQ',
  GOLD_ETF: 'COMMODITIES',
  SILVER_ETF: 'COMMODITIES',
  SGB: 'COMMODITIES',
  STOCK_US: 'US_EQ',
  PLATINUM_ETF: 'COMMODITIES',
  COPPER_ETF: 'COMMODITIES',
  MUTUAL_FUND: 'MUTUAL_FUNDS',
  EPF: 'DEBT',
  PPF: 'DEBT',
  REIT: 'REITS',
  CRYPTO: 'CRYPTO',
};

export const TYPE_TO_COMMODITY: Partial<Record<InstrumentType, CommodityType>> = {
  GOLD_ETF: 'GOLD',
  SILVER_ETF: 'SILVER',
  SGB: 'GOLD',
  PLATINUM_ETF: 'PLATINUM',
  COPPER_ETF: 'COPPER',
};
