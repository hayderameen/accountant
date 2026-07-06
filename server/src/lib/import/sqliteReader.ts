import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';

const SQLITE_MAGIC = 'SQLite format 3';

function readHeader(filePath: string, length: number): Buffer {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(length);
  fs.readSync(fd, buf, 0, length, 0);
  fs.closeSync(fd);
  return buf;
}

export function isSqliteFile(filePath: string): boolean {
  try {
    const header = readHeader(filePath, 16).toString('utf8', 0, 15);
    return header === SQLITE_MAGIC;
  } catch {
    return false;
  }
}

function isZipFile(filePath: string): boolean {
  try {
    const buf = readHeader(filePath, 4);
    return buf[0] === 0x50 && buf[1] === 0x4b;
  } catch {
    return false;
  }
}

function extractSqliteFromZip(filePath: string): string {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);

  if (entries.length === 0) {
    throw new Error('Backup archive is empty');
  }

  const sqliteEntry =
    entries.find((e) => {
      const name = e.entryName.toLowerCase();
      return name.endsWith('.sqlite') || name.endsWith('.db') || name.endsWith('.mmbak');
    }) ??
    entries.reduce((largest, entry) =>
      entry.header.size > largest.header.size ? entry : largest
    );

  const out = path.join(os.tmpdir(), `mm-import-${Date.now()}.sqlite`);
  fs.writeFileSync(out, sqliteEntry.getData());
  return out;
}

export function resolveSqlitePath(filePath: string): string {
  if (isSqliteFile(filePath)) {
    return filePath;
  }

  if (isZipFile(filePath)) {
    return extractSqliteFromZip(filePath);
  }

  // Some .mmbak exports are SQLite without a standard header offset — try direct open last
  if (path.extname(filePath).toLowerCase() === '.mmbak') {
    try {
      const db = new Database(filePath, { readonly: true, fileMustExist: true });
      db.close();
      return filePath;
    } catch {
      throw new Error(
        'Unrecognized .mmbak format. Try exporting money_android.sqlite via MM → Backup → Email instead.'
      );
    }
  }

  return filePath;
}

export function openDatabase(filePath: string) {
  const sqlitePath = resolveSqlitePath(filePath);
  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  return { db, sqlitePath, isExtracted: sqlitePath !== filePath };
}

export function tableColumns(db: Database.Database, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

export function pickColumn(columns: string[], candidates: string[]): string | null {
  const lower = new Map(columns.map((c) => [c.toLowerCase(), c]));
  for (const candidate of candidates) {
    const hit = lower.get(candidate.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

export function findTable(db: Database.Database, candidates: string[]): string | null {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
    .all() as { name: string }[];
  const names = new Set(tables.map((t) => t.name.toLowerCase()));
  for (const c of candidates) {
    if (names.has(c.toLowerCase())) {
      return tables.find((t) => t.name.toLowerCase() === c.toLowerCase())!.name;
    }
  }
  return null;
}

export function isDeleted(row: Record<string, unknown>, delCol: string | null): boolean {
  if (!delCol) return false;
  const v = row[delCol];
  return v === 1 || v === '1' || v === true;
}
