import * as SQLite from 'expo-sqlite';

/** Todo se guarda solo en el celular. Nada sale del teléfono. */
export type ReadingKind = 'hr' | 'spo2' | 'bp' | 'temp' | 'steps' | 'hrv' | 'battery';

export interface Reading {
  id: number;
  at: string; // ISO
  kind: ReadingKind;
  v1: number;
  v2: number | null;
  source: 'live' | 'history';
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('smartring.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS readings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          kind TEXT NOT NULL,
          v1 REAL NOT NULL,
          v2 REAL,
          source TEXT NOT NULL,
          UNIQUE(at, kind, source)
        );
        CREATE INDEX IF NOT EXISTS idx_readings_kind_at ON readings(kind, at);
        CREATE TABLE IF NOT EXISTS raw_frames (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          cmd INTEGER NOT NULL,
          hex TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function addReading(kind: ReadingKind, v1: number, v2: number | null, source: Reading['source'], at = new Date()): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO readings (at, kind, v1, v2, source) VALUES (?, ?, ?, ?, ?)',
    at.toISOString(), kind, v1, v2, source,
  );
}

export async function latestByKind(): Promise<Partial<Record<ReadingKind, Reading>>> {
  const db = await getDb();
  const rows = await db.getAllAsync<Reading>(
    `SELECT r.* FROM readings r
     JOIN (SELECT kind, MAX(at) AS at FROM readings GROUP BY kind) m ON m.kind = r.kind AND m.at = r.at`,
  );
  const out: Partial<Record<ReadingKind, Reading>> = {};
  for (const r of rows) out[r.kind] = r;
  return out;
}

export async function listReadings(kind: ReadingKind | null, limit = 200): Promise<Reading[]> {
  const db = await getDb();
  return kind
    ? db.getAllAsync<Reading>('SELECT * FROM readings WHERE kind = ? ORDER BY at DESC LIMIT ?', kind, limit)
    : db.getAllAsync<Reading>("SELECT * FROM readings WHERE kind != 'battery' ORDER BY at DESC LIMIT ?", limit);
}

export async function saveRawFrames(frames: { cmd: number; payload: Uint8Array }[]): Promise<void> {
  if (!frames.length) return;
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const f of frames) {
      const hex = Array.from(f.payload, (b) => b.toString(16).padStart(2, '0')).join('');
      await db.runAsync('INSERT INTO raw_frames (at, cmd, hex) VALUES (?, ?, ?)', now, f.cmd, hex);
    }
  });
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
