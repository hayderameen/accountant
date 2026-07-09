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
    // Store full parsed data so confirm doesn't need the file again
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
    const accountIdByExternal = new Map<string, mongoose.Types.ObjectId>();
    const accountCurrencyById = new Map<string, string>();

    for (const a of parsed.accounts) {
      const existing = await Account.findOne({ userId, externalUid: a.externalUid });
      if (existing) {
        accountIdByExternal.set(a.externalUid, existing._id);
        accountCurrencyById.set(existing._id.toString(), existing.currency);
        continue;
      }
      const created = await Account.create({
        userId,
        name: a.name,
        balance: a.balance,
        externalUid: a.externalUid,
        source: "money_manager",
      });
      accountIdByExternal.set(a.externalUid, created._id);
      accountCurrencyById.set(created._id.toString(), created.currency);
    }

    const user = await User.findById(userId).select("settings.defaultCurrency");
    const userDefault = user?.settings?.defaultCurrency ?? "PKR";

    const categoryIdByExternal = new Map<string, mongoose.Types.ObjectId>();
    for (const c of parsed.categories) {
      const existing = await Category.findOne({ userId, externalUid: c.externalUid });
      if (existing) {
        categoryIdByExternal.set(c.externalUid, existing._id);
        continue;
      }
      const parentId =
        c.parentExternalUid && categoryIdByExternal.get(c.parentExternalUid)
          ? categoryIdByExternal.get(c.parentExternalUid)
          : undefined;
      const created = await Category.create({
        userId,
        name: c.name,
        type: c.type,
        parentId,
        externalUid: c.externalUid,
        source: "money_manager",
      });
      categoryIdByExternal.set(c.externalUid, created._id);
    }

    let imported = 0;
    let skipped = 0;

    for (const t of parsed.transactions) {
      const dup = await Transaction.findOne({ userId, externalUid: t.externalUid });
      if (dup) { skipped++; continue; }

      const accountId = accountIdByExternal.get(t.accountExternalUid);
      if (!accountId) continue;

      const currency = resolveCurrency(
        undefined,
        accountCurrencyById.get(accountId.toString()),
        userDefault,
      );

      await Transaction.create({
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
        importedAt: new Date(),
      });
      imported++;
    }

    if (runAutomationsOnImport) {
      const importedIncome = await Transaction.find({
        userId,
        source: "money_manager",
        type: "income",
      });
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
