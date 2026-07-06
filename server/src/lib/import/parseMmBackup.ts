import type Database from 'better-sqlite3';
import {
  findTable,
  tableColumns,
  pickColumn,
  isDeleted,
} from './sqliteReader.js';

export interface MmPreview {
  accounts: number;
  categories: number;
  transactions: number;
  incomeTotal: number;
  expenseTotal: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface MmParsed {
  preview: MmPreview;
  accounts: { externalUid: string; name: string; balance: number }[];
  categories: {
    externalUid: string;
    name: string;
    type: 'income' | 'expense';
    parentExternalUid?: string;
  }[];
  transactions: {
    externalUid: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    date: Date;
    accountExternalUid: string;
    categoryExternalUid?: string;
    toAccountExternalUid?: string;
    memo?: string;
  }[];
}

const TXN_TABLES = ['INOUTCOME', 'ZINOUTCOME', 'inoutcome'];
const CAT_TABLES = ['ZCATEGORY', 'CATEGORY', 'category'];
const ASSET_TABLES = ['ASSETS', 'ZASSETS', 'ASSET', 'assets'];

const TYPE_MAP: Record<string, 'income' | 'expense' | 'transfer'> = {
  '0': 'income',
  '1': 'expense',
  '7': 'transfer',
};

function toCents(raw: unknown): number {
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100);
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapTxnType(raw: unknown): 'income' | 'expense' | 'transfer' | null {
  const key = String(raw);
  return TYPE_MAP[key] ?? null;
}

function mapCatType(raw: unknown): 'income' | 'expense' {
  const key = String(raw);
  return key === '0' ? 'income' : 'expense';
}

export function parseMoneyManagerBackup(db: Database.Database): MmParsed {
  const txnTable = findTable(db, TXN_TABLES);
  const catTable = findTable(db, CAT_TABLES);
  const assetTable = findTable(db, ASSET_TABLES);

  if (!txnTable) throw new Error('Transaction table not found in backup');

  const txnCols = tableColumns(db, txnTable);
  const amountCol = pickColumn(txnCols, ['ZMONEY', 'AMOUNT', 'amount', 'ZAMOUNT']);
  const dateCol = pickColumn(txnCols, ['WDATE', 'wdate', 'ZDATE', 'DATE', 'date', 'ZTIME']);
  const typeCol = pickColumn(txnCols, ['DO_TYPE', 'type', 'TYPE', 'ZTYPE', 'inoutType']);
  const catFkCol = pickColumn(txnCols, ['ctgUid', 'CTGUID', 'ZCATEGORY', 'categoryUid', 'ctg_uid']);
  const assetFkCol = pickColumn(txnCols, ['assetUid', 'ASSETUID', 'ASSETS', 'asset_uid']);
  const toAssetCol = pickColumn(txnCols, ['toAssetUid', 'TOASSETUID', 'to_asset_uid', 'toAssetUID']);
  const memoCol = pickColumn(txnCols, ['ZCONTENT', 'MEMO', 'memo', 'content', 'ZCOMMENT', 'comment']);
  const uidCol = pickColumn(txnCols, ['uid', 'UID', 'C_UID', '_id', 'id', 'ZUID']);
  const delCol = pickColumn(txnCols, ['IS_DEL', 'is_del', 'C_IS_DEL', 'isDel', 'ZISDEL']);

  if (!amountCol || !dateCol || !typeCol || !assetFkCol || !uidCol) {
    throw new Error('Unsupported Money Manager backup schema');
  }

  const accounts: MmParsed['accounts'] = [];
  const accountMap = new Map<string, string>();

  if (assetTable) {
    const assetCols = tableColumns(db, assetTable);
    const assetUidCol = pickColumn(assetCols, ['uid', 'UID', 'C_UID', 'id', 'ZUID']);
    const assetNameCol = pickColumn(assetCols, ['NIC_NAME', 'nic_name', 'ZNICNAME', 'ZNAME', 'NAME', 'name']);
    const balanceCol = pickColumn(assetCols, ['ZMONEY', 'AMOUNT', 'balance', 'ZAMOUNT']);
    const assetDelCol = pickColumn(assetCols, ['IS_DEL', 'is_del', 'C_IS_DEL']);

    if (assetUidCol && assetNameCol) {
      const rows = db.prepare(`SELECT * FROM ${assetTable}`).all() as Record<string, unknown>[];
      for (const row of rows) {
        if (isDeleted(row, assetDelCol)) continue;
        const externalUid = String(row[assetUidCol]);
        const name = String(row[assetNameCol] ?? 'Account');
        const balance = balanceCol ? toCents(row[balanceCol]) : 0;
        accounts.push({ externalUid, name, balance });
        accountMap.set(externalUid, name);
      }
    }
  }

  const categories: MmParsed['categories'] = [];
  const categoryParent = new Map<string, string | undefined>();

  if (catTable) {
    const catCols = tableColumns(db, catTable);
    const catUidCol = pickColumn(catCols, ['uid', 'UID', 'C_UID', 'id', 'ZUID']);
    const catNameCol = pickColumn(catCols, ['NAME', 'name', 'ZNAME', 'ZCTGNAME', 'category_name']);
    const catTypeCol = pickColumn(catCols, ['TYPE', 'type', 'ZTYPE']);
    const parentCol = pickColumn(catCols, ['pUid', 'PUID', 'parent_uid', 'parentUid', 'P_UID']);
    const catDelCol = pickColumn(catCols, ['IS_DEL', 'is_del', 'C_IS_DEL']);

    if (catUidCol && catNameCol) {
      const rows = db.prepare(`SELECT * FROM ${catTable}`).all() as Record<string, unknown>[];
      for (const row of rows) {
        if (isDeleted(row, catDelCol)) continue;
        const externalUid = String(row[catUidCol]);
        const name = String(row[catNameCol]);
        const type = catTypeCol ? mapCatType(row[catTypeCol]) : 'expense';
        const parentExternalUid =
          parentCol && row[parentCol] && String(row[parentCol]) !== '0'
            ? String(row[parentCol])
            : undefined;
        categories.push({ externalUid, name, type, parentExternalUid });
        categoryParent.set(externalUid, parentExternalUid);
      }
    }
  }

  const transactions: MmParsed['transactions'] = [];
  let incomeTotal = 0;
  let expenseTotal = 0;
  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;

  const txnRows = db.prepare(`SELECT * FROM ${txnTable}`).all() as Record<string, unknown>[];
  for (const row of txnRows) {
    if (isDeleted(row, delCol)) continue;
    const type = mapTxnType(row[typeCol]);
    if (!type) continue;

    const date = parseDate(row[dateCol]);
    if (!date) continue;

    const amount = toCents(row[amountCol]);
    if (amount <= 0) continue;

    const accountExternalUid = String(row[assetFkCol]);
    if (!accountMap.has(accountExternalUid)) {
      accountMap.set(accountExternalUid, `Account ${accountExternalUid.slice(0, 6)}`);
      accounts.push({ externalUid: accountExternalUid, name: accountMap.get(accountExternalUid)!, balance: 0 });
    }

    if (type === 'income') incomeTotal += amount;
    if (type === 'expense') expenseTotal += amount;

    if (!dateFrom || date < dateFrom) dateFrom = date;
    if (!dateTo || date > dateTo) dateTo = date;

    transactions.push({
      externalUid: String(row[uidCol]),
      type,
      amount,
      date,
      accountExternalUid,
      categoryExternalUid: catFkCol && row[catFkCol] ? String(row[catFkCol]) : undefined,
      toAccountExternalUid: toAssetCol && row[toAssetCol] ? String(row[toAssetCol]) : undefined,
      memo: memoCol && row[memoCol] ? String(row[memoCol]) : undefined,
    });
  }

  const preview: MmPreview = {
    accounts: accounts.length,
    categories: categories.length,
    transactions: transactions.length,
    incomeTotal,
    expenseTotal,
    dateFrom: dateFrom?.toISOString() ?? null,
    dateTo: dateTo?.toISOString() ?? null,
  };

  return { preview, accounts, categories, transactions };
}
