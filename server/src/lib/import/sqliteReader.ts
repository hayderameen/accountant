import { readFileSync } from 'fs';
import { createRequire } from 'module';
import AdmZip from 'adm-zip';
import initSqlJs, { type Database } from 'sql.js';

export type SqliteDb = Database;

// Cached sql.js instance — WASM is loaded once per process/warm invocation
let _SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSql(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
  if (_SQL) return _SQL;
  try {
    // Explicit WASM path is required in bundled/serverless environments
    const require = createRequire(import.meta.url);
    const nodeBuf = readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
    const wasmBinary = nodeBuf.buffer.slice(
      nodeBuf.byteOffset,
      nodeBuf.byteOffset + nodeBuf.byteLength,
    ) as ArrayBuffer;
    _SQL = await initSqlJs({ wasmBinary });
  } catch {
    // Fallback: let sql.js auto-discover WASM (works in standard Node.js)
    _SQL = await initSqlJs();
  }
  return _SQL;
}

const SQLITE_MAGIC = Buffer.from('SQLite format 3', 'utf8');

function isSqliteBuffer(buf: Buffer): boolean {
  return buf.length >= 15 && buf.subarray(0, 15).equals(SQLITE_MAGIC);
}

function isZipBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function extractSqliteFromZip(buf: Buffer): Buffer {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (!entries.length) throw new Error('Backup archive is empty');

  const entry =
    entries.find((e) => {
      const name = e.entryName.toLowerCase();
      return name.endsWith('.sqlite') || name.endsWith('.db') || name.endsWith('.mmbak');
    }) ?? entries.reduce((a, b) => (b.header.size > a.header.size ? b : a));

  return entry.getData();
}

/** Opens a SQLite database from a Buffer (file or ZIP containing SQLite). */
export async function openDatabase(buf: Buffer): Promise<SqliteDb> {
  const SQL = await getSql();

  let sqliteBuf: Buffer;
  if (isSqliteBuffer(buf)) {
    sqliteBuf = buf;
  } else if (isZipBuffer(buf)) {
    sqliteBuf = extractSqliteFromZip(buf);
  } else {
    // Last resort: try treating the raw buffer as SQLite
    sqliteBuf = buf;
  }

  return new SQL.Database(sqliteBuf);
}

/** Runs a SELECT and returns rows as plain objects (mirrors better-sqlite3's `.all()`). */
export function queryAll(db: SqliteDb, sql: string): Record<string, unknown>[] {
  const results = db.exec(sql);
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

export function tableColumns(db: SqliteDb, table: string): string[] {
  const rows = queryAll(db, `PRAGMA table_info("${table}")`);
  return rows.map((r) => r.name as string);
}

export function pickColumn(columns: string[], candidates: string[]): string | null {
  const lower = new Map(columns.map((c) => [c.toLowerCase(), c]));
  for (const c of candidates) {
    const hit = lower.get(c.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

export function findTable(db: SqliteDb, candidates: string[]): string | null {
  const tables = queryAll(db, "SELECT name FROM sqlite_master WHERE type='table'");
  const names = new Set(tables.map((t) => (t.name as string).toLowerCase()));
  for (const c of candidates) {
    if (names.has(c.toLowerCase())) {
      return tables.find((t) => (t.name as string).toLowerCase() === c.toLowerCase())!
        .name as string;
    }
  }
  return null;
}

export function isDeleted(row: Record<string, unknown>, delCol: string | null): boolean {
  if (!delCol) return false;
  const v = row[delCol];
  return v === 1 || v === '1' || v === true;
}
