import mongoose from "mongoose";
import { openDatabase } from "./sqliteReader.js";
import { parseMoneyManagerBackup } from "./parseMmBackup.js";
import { ImportJob } from "../../models/ImportJob.js";
import { Account } from "../../models/Account.js";
import { Category } from "../../models/Category.js";
import { Transaction } from "../../models/Transaction.js";
import { User } from "../../models/User.js";
import { resolveCurrency } from "../currency.js";
import { onIncomeCreated } from "../../services/automationEngine.js";

const BATCH_SIZE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** No-op kept for backward compatibility with import.ts route */
export function ensureUploadDir() {}

export async function createImportPreview(
  userId: string,
  fileBuffer: Buffer,
  fileName: string,
) {
  const db = await openDatabase(fileBuffer);
  let parsed;
  try {
    parsed = parseMoneyManagerBackup(db);
  } finally {
    db.close();
  }

  const job = await ImportJob.create({
    userId,
    status: "preview",
    fileName,
    preview: parsed.preview,
    parsedData: parsed,
  });

  return { jobId: job._id.toString(), preview: parsed.preview };
}

export async function confirmImport(
  userId: string,
  jobId: string,
  runAutomationsOnImport: boolean,
) {
  const job = await ImportJob.findOne({ _id: jobId, userId, status: "preview" });
  if (!job?.parsedData) {
    throw new Error("Import job not found or has expired");
  }

  const parsed = job.parsedData as Awaited<ReturnType<typeof parseMoneyManagerBackup>>;

  try {
    // ── Accounts ──────────────────────────────────────────────────────────────
    const accountExternalUids = parsed.accounts.map((a) => a.externalUid);
    const existingAccounts = await Account.find({
      userId,
      externalUid: { $in: accountExternalUids },
    }).select("_id externalUid currency");

    const accountIdByExternal = new Map<string, mongoose.Types.ObjectId>();
    const accountCurrencyById = new Map<string, string>();
    const existingAccountUids = new Set<string>();

    for (const acc of existingAccounts) {
      accountIdByExternal.set(acc.externalUid!, acc._id);
      accountCurrencyById.set(acc._id.toString(), acc.currency!);
      existingAccountUids.add(acc.externalUid!);
    }

    const user = await User.findById(userId).select("settings.defaultCurrency");
    const userDefault = user?.settings?.defaultCurrency ?? "PKR";

    // Pre-assign IDs for new accounts so we have them before insertMany
    const newAccountDocs = parsed.accounts
      .filter((a) => !existingAccountUids.has(a.externalUid))
      .map((a) => {
        const id = new mongoose.Types.ObjectId();
        accountIdByExternal.set(a.externalUid, id);
        accountCurrencyById.set(id.toString(), userDefault);
        return {
          _id: id,
          userId,
          name: a.name,
          balance: a.balance,
          currency: userDefault,
          externalUid: a.externalUid,
          source: "money_manager",
        };
      });

    if (newAccountDocs.length) {
      await Account.insertMany(newAccountDocs, { ordered: false });
    }

    // ── Categories ────────────────────────────────────────────────────────────
    const categoryExternalUids = parsed.categories.map((c) => c.externalUid);
    const existingCategories = await Category.find({
      userId,
      externalUid: { $in: categoryExternalUids },
    }).select("_id externalUid");

    const categoryIdByExternal = new Map<string, mongoose.Types.ObjectId>();
    const existingCategoryUids = new Set<string>();

    for (const cat of existingCategories) {
      categoryIdByExternal.set(cat.externalUid!, cat._id);
      existingCategoryUids.add(cat.externalUid!);
    }

    // Pre-assign IDs for all new categories first so parent refs resolve correctly
    for (const c of parsed.categories) {
      if (!existingCategoryUids.has(c.externalUid)) {
        categoryIdByExternal.set(c.externalUid, new mongoose.Types.ObjectId());
      }
    }

    const newCategoryDocs = parsed.categories
      .filter((c) => !existingCategoryUids.has(c.externalUid))
      .map((c) => ({
        _id: categoryIdByExternal.get(c.externalUid)!,
        userId,
        name: c.name,
        type: c.type,
        parentId:
          c.parentExternalUid && categoryIdByExternal.has(c.parentExternalUid)
            ? categoryIdByExternal.get(c.parentExternalUid)
            : undefined,
        externalUid: c.externalUid,
        source: "money_manager",
      }));

    if (newCategoryDocs.length) {
      await Category.insertMany(newCategoryDocs, { ordered: false });
    }

    // ── Transactions ──────────────────────────────────────────────────────────
    // One query to get all already-imported externalUids — no per-row dup check
    const txnExternalUids = parsed.transactions.map((t) => t.externalUid);
    const existingTxns = await Transaction.find({
      userId,
      externalUid: { $in: txnExternalUids },
    }).select("externalUid");
    const existingTxnUids = new Set(existingTxns.map((t) => t.externalUid as string));

    const importedAt = new Date();
    const newTxnDocs = parsed.transactions
      .filter((t) => !existingTxnUids.has(t.externalUid))
      .flatMap((t) => {
        const accountId = accountIdByExternal.get(t.accountExternalUid);
        if (!accountId) return [];
        const currency = resolveCurrency(
          undefined,
          accountCurrencyById.get(accountId.toString()),
          userDefault,
        );
        return [{
          userId,
          type: t.type,
          amount: t.amount,
          date: t.date,
          accountId,
          categoryId: t.categoryExternalUid
            ? categoryIdByExternal.get(t.categoryExternalUid)
            : undefined,
          toAccountId: t.toAccountExternalUid
            ? accountIdByExternal.get(t.toAccountExternalUid)
            : undefined,
          currency,
          memo: t.memo,
          externalUid: t.externalUid,
          source: "money_manager",
          importedAt,
        }];
      });

    // Insert in chunks to avoid hitting MongoDB's 16 MB document/batch limits
    for (const batch of chunk(newTxnDocs, BATCH_SIZE)) {
      await Transaction.insertMany(batch, { ordered: false });
    }

    const imported = newTxnDocs.length;
    const skipped = parsed.transactions.length - imported;

    if (runAutomationsOnImport) {
      const importedIncome = await Transaction.find({
        userId,
        source: "money_manager",
        type: "income",
      }).select("_id amount");
      for (const txn of importedIncome) {
        await onIncomeCreated(userId, txn._id.toString(), txn.amount, "money_manager");
      }
    }

    job.status = "completed";
    job.preview = { ...parsed.preview, imported, skipped };
    job.parsedData = undefined;
    await job.save();

    return { imported, skipped, preview: parsed.preview };
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Import failed";
    await job.save();
    throw err;
  }
}
