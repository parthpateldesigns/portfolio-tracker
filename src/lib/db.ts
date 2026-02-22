import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Instrument, PortfolioSnapshot } from '@/types';

const DATA_DIR = join(process.cwd(), 'data');
const INSTRUMENTS_FILE = join(DATA_DIR, 'instruments.json');
const SNAPSHOTS_FILE = join(DATA_DIR, 'snapshots.json');
const SETTINGS_FILE = join(DATA_DIR, 'settings.json');

function ensureDataDir() {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readJSON<T>(filePath: string, fallback: T): T {
    ensureDataDir();
    if (!existsSync(filePath)) {
        writeFileSync(filePath, JSON.stringify(fallback, null, 2));
        return fallback;
    }
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
        return fallback;
    }
}

function writeJSON<T>(filePath: string, data: T): void {
    ensureDataDir();
    writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ===== Instruments =====
export function getAllInstruments(): Instrument[] {
    return readJSON<Instrument[]>(INSTRUMENTS_FILE, []);
}

export function getInstrumentsByCategory(category: string): Instrument[] {
    return getAllInstruments().filter(i => i.category === category);
}

export function getInstrumentById(id: string): Instrument | undefined {
    return getAllInstruments().find(i => i.id === id);
}

export function getInstrumentByTicker(ticker: string): Instrument | undefined {
    return getAllInstruments().find(
        i => i.ticker.toUpperCase() === ticker.toUpperCase()
    );
}

export function addInstrument(instrument: Instrument): Instrument {
    const instruments = getAllInstruments();
    instruments.push(instrument);
    writeJSON(INSTRUMENTS_FILE, instruments);
    return instrument;
}

export function updateInstrument(id: string, updates: Partial<Instrument>): Instrument | null {
    const instruments = getAllInstruments();
    const index = instruments.findIndex(i => i.id === id);
    if (index === -1) return null;
    instruments[index] = { ...instruments[index], ...updates, updatedAt: new Date().toISOString() };
    writeJSON(INSTRUMENTS_FILE, instruments);
    return instruments[index];
}

export function deleteInstrument(id: string): boolean {
    const instruments = getAllInstruments();
    const filtered = instruments.filter(i => i.id !== id);
    if (filtered.length === instruments.length) return false;
    writeJSON(INSTRUMENTS_FILE, filtered);
    return true;
}

export function findDuplicates(ticker: string, name: string): Instrument[] {
    const instruments = getAllInstruments();
    return instruments.filter(i =>
        i.ticker.toUpperCase() === ticker.toUpperCase() ||
        i.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(i.name.toLowerCase())
    );
}

// ===== Snapshots =====
export function getAllSnapshots(): PortfolioSnapshot[] {
    return readJSON<PortfolioSnapshot[]>(SNAPSHOTS_FILE, []);
}

export function addSnapshot(snapshot: PortfolioSnapshot): void {
    const snapshots = getAllSnapshots();
    snapshots.push(snapshot);
    writeJSON(SNAPSHOTS_FILE, snapshots);
}

// ===== Settings =====
export interface AppSettings {
    geminiApiKey: string;
    refreshIntervalMs: number;
    defaultCurrency: 'INR' | 'USD';
}

const DEFAULT_SETTINGS: AppSettings = {
    geminiApiKey: '',
    refreshIntervalMs: 30000,
    defaultCurrency: 'INR',
};

export function getSettings(): AppSettings {
    return readJSON<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
    const current = getSettings();
    const updated = { ...current, ...updates };
    writeJSON(SETTINGS_FILE, updated);
    return updated;
}
