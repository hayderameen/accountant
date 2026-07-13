import { Transaction } from "../models/Transaction.js";
import { Obligation } from "../models/Obligation.js";
import { LoanTransaction } from "../models/LoanTransaction.js";
import { PaymentBack } from "../models/PaymentBack.js";

export type StatsGroupBy = "day" | "week" | "month";

type CategoryTotal = {
  categoryId: string | null;
  categoryName: string;
  amount: number;
};

type IncomeExpensePoint = {
  bucket: string;
  label: string;
  income: number;
  expense: number;
};

type LoanPoint = {
  bucket: string;
  label: string;
  taken: number;
  given: number;
  repaymentsMade: number;
  repaymentsReceived: number;
};

type LoanEntityTotal = {
  entityId: string;
  entityName: string;
  direction: "i_owe" | "they_owe_me";
  taken: number;
  given: number;
  repaymentsMade: number;
  repaymentsReceived: number;
};

export interface StatsResponse {
  range: {
    from: string;
    to: string;
    groupBy: StatsGroupBy;
    timezone: string;
  };
  incomeExpense: Array<{
    currency: string;
    income: number;
    expense: number;
    net: number;
    incomeCategories: CategoryTotal[];
    expenseCategories: CategoryTotal[];
    series: IncomeExpensePoint[];
  }>;
  loans: Array<{
    currency: string;
    taken: number;
    given: number;
    repaymentsMade: number;
    repaymentsReceived: number;
    byEntity: LoanEntityTotal[];
    series: LoanPoint[];
  }>;
}

type PopulatedRef = {
  _id: unknown;
  name?: string;
  direction?: "i_owe" | "they_owe_me";
  type?: "income" | "expense";
};

type StatsTransaction = {
  _id: unknown;
  type: "income" | "expense" | "transfer";
  amount: number;
  date: Date;
  currency?: string;
  categoryId?: PopulatedRef | null;
  entityId?: PopulatedRef | null;
};

type StatsObligation = {
  _id: unknown;
  totalDue: number;
  currency?: string;
  createdAt: Date;
  entityId?: PopulatedRef | null;
  sourceTransactionId?: { date?: Date } | null;
};

type StatsLoanTransaction = {
  type: "loan_given" | "loan_received" | "repayment_made" | "repayment_received";
  amount: number;
  currency?: string;
  date: Date;
  entityId?: PopulatedRef | null;
};

type StatsPaymentBack = {
  transactionId: unknown;
  totalAmount: number;
  currency?: string;
  date: Date;
  entityId?: PopulatedRef | null;
};

type IncomeExpenseAccumulator = {
  income: number;
  expense: number;
  incomeCategories: Map<string, CategoryTotal>;
  expenseCategories: Map<string, CategoryTotal>;
  series: Map<string, IncomeExpensePoint>;
};

type LoanAccumulator = {
  taken: number;
  given: number;
  repaymentsMade: number;
  repaymentsReceived: number;
  byEntity: Map<string, LoanEntityTotal>;
  series: Map<string, LoanPoint>;
};

function localDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function isoWeek(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const weekYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604_800_000);
  return { year: weekYear, week };
}

function bucketFor(date: Date, groupBy: StatsGroupBy, timezone: string) {
  const { year, month, day } = localDateParts(date, timezone);
  if (groupBy === "month") {
    const bucket = `${year}-${String(month).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
    return { bucket, label };
  }
  if (groupBy === "week") {
    const iso = isoWeek(year, month, day);
    return {
      bucket: `${iso.year}-W${String(iso.week).padStart(2, "0")}`,
      label: `Week ${iso.week}`,
    };
  }
  const bucket = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return { bucket, label };
}

function refId(ref: PopulatedRef | null | undefined): string {
  return ref?._id ? String(ref._id) : "";
}

function currencyOf(value?: string): string {
  return value?.trim().toUpperCase() || "PKR";
}

function ensureIncomeExpense(
  map: Map<string, IncomeExpenseAccumulator>,
  currency: string,
) {
  let accumulator = map.get(currency);
  if (!accumulator) {
    accumulator = {
      income: 0,
      expense: 0,
      incomeCategories: new Map(),
      expenseCategories: new Map(),
      series: new Map(),
    };
    map.set(currency, accumulator);
  }
  return accumulator;
}

function ensureLoan(map: Map<string, LoanAccumulator>, currency: string) {
  let accumulator = map.get(currency);
  if (!accumulator) {
    accumulator = {
      taken: 0,
      given: 0,
      repaymentsMade: 0,
      repaymentsReceived: 0,
      byEntity: new Map(),
      series: new Map(),
    };
    map.set(currency, accumulator);
  }
  return accumulator;
}

function recordIncomeExpense(
  map: Map<string, IncomeExpenseAccumulator>,
  transaction: StatsTransaction,
  groupBy: StatsGroupBy,
  timezone: string,
) {
  if (transaction.type === "transfer" || transaction.entityId) return;
  const currency = currencyOf(transaction.currency);
  const accumulator = ensureIncomeExpense(map, currency);
  const isIncome = transaction.type === "income";
  if (isIncome) accumulator.income += transaction.amount;
  else accumulator.expense += transaction.amount;

  const categoryId = refId(transaction.categoryId) || null;
  const categoryName = transaction.categoryId?.name?.trim() || "Uncategorized";
  const categoryKey = categoryId ?? "uncategorized";
  const categories = isIncome
    ? accumulator.incomeCategories
    : accumulator.expenseCategories;
  const category = categories.get(categoryKey) ?? {
    categoryId,
    categoryName,
    amount: 0,
  };
  category.amount += transaction.amount;
  categories.set(categoryKey, category);

  const { bucket, label } = bucketFor(transaction.date, groupBy, timezone);
  const point = accumulator.series.get(bucket) ?? {
    bucket,
    label,
    income: 0,
    expense: 0,
  };
  if (isIncome) point.income += transaction.amount;
  else point.expense += transaction.amount;
  accumulator.series.set(bucket, point);
}

function recordLoan(
  map: Map<string, LoanAccumulator>,
  event: {
    currency?: string;
    date: Date;
    entity?: PopulatedRef | null;
    metric: "taken" | "given" | "repaymentsMade" | "repaymentsReceived";
    amount: number;
  },
  groupBy: StatsGroupBy,
  timezone: string,
) {
  const currency = currencyOf(event.currency);
  const accumulator = ensureLoan(map, currency);
  accumulator[event.metric] += event.amount;

  const { bucket, label } = bucketFor(event.date, groupBy, timezone);
  const point = accumulator.series.get(bucket) ?? {
    bucket,
    label,
    taken: 0,
    given: 0,
    repaymentsMade: 0,
    repaymentsReceived: 0,
  };
  point[event.metric] += event.amount;
  accumulator.series.set(bucket, point);

  const entityId = refId(event.entity);
  if (!entityId) return;
  const direction = event.entity?.direction ?? (
    event.metric === "given" || event.metric === "repaymentsReceived"
      ? "they_owe_me"
      : "i_owe"
  );
  const entity = accumulator.byEntity.get(entityId) ?? {
    entityId,
    entityName: event.entity?.name || "Unknown",
    direction,
    taken: 0,
    given: 0,
    repaymentsMade: 0,
    repaymentsReceived: 0,
  };
  entity[event.metric] += event.amount;
  accumulator.byEntity.set(entityId, entity);
}

function inRange(date: Date, from: Date, to: Date) {
  const time = date.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function bucketSequence(
  from: Date,
  to: Date,
  groupBy: StatsGroupBy,
  timezone: string,
) {
  const buckets = new Map<string, { bucket: string; label: string }>();
  const cursor = new Date(from);
  while (cursor <= to) {
    const value = bucketFor(cursor, groupBy, timezone);
    buckets.set(value.bucket, value);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const finalValue = bucketFor(to, groupBy, timezone);
  buckets.set(finalValue.bucket, finalValue);
  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export async function getStats(params: {
  userId: string;
  from: Date;
  to: Date;
  groupBy: StatsGroupBy;
  timezone: string;
}): Promise<StatsResponse> {
  const { userId, from, to, groupBy, timezone } = params;
  const dateRange = { $gte: from, $lte: to };

  const [transactions, loanTransactions, paymentBacks, obligations] =
    await Promise.all([
      Transaction.find({ userId, date: dateRange })
        .select("_id type amount date currency categoryId entityId")
        .populate("categoryId", "name type")
        .populate("entityId", "name direction")
        .lean() as unknown as Promise<StatsTransaction[]>,
      LoanTransaction.find({ userId, date: dateRange })
        .select("type amount currency date entityId")
        .populate("entityId", "name direction")
        .lean() as unknown as Promise<StatsLoanTransaction[]>,
      PaymentBack.find({ userId, date: dateRange })
        .select("transactionId totalAmount currency date entityId")
        .populate("entityId", "name direction")
        .lean() as unknown as Promise<StatsPaymentBack[]>,
      Obligation.find({ userId })
        .select("totalDue currency createdAt entityId sourceTransactionId")
        .populate("entityId", "name direction")
        .populate("sourceTransactionId", "date")
        .lean() as unknown as Promise<StatsObligation[]>,
    ]);

  const incomeExpenseMap = new Map<string, IncomeExpenseAccumulator>();
  const loanMap = new Map<string, LoanAccumulator>();
  const buckets = bucketSequence(from, to, groupBy, timezone);
  const paymentTransactionIds = new Set(
    paymentBacks.map((payment) => String(payment.transactionId)),
  );

  for (const transaction of transactions) {
    recordIncomeExpense(incomeExpenseMap, transaction, groupBy, timezone);
    if (!transaction.entityId) continue;
    if (transaction.type === "income") {
      recordLoan(
        loanMap,
        {
          currency: transaction.currency,
          date: transaction.date,
          entity: transaction.entityId,
          metric: "taken",
          amount: transaction.amount,
        },
        groupBy,
        timezone,
      );
    } else if (
      transaction.type === "expense" &&
      !paymentTransactionIds.has(String(transaction._id))
    ) {
      recordLoan(
        loanMap,
        {
          currency: transaction.currency,
          date: transaction.date,
          entity: transaction.entityId,
          metric: "repaymentsMade",
          amount: transaction.amount,
        },
        groupBy,
        timezone,
      );
    }
  }

  for (const obligation of obligations) {
    const effectiveDate = obligation.sourceTransactionId?.date
      ? new Date(obligation.sourceTransactionId.date)
      : new Date(obligation.createdAt);
    if (!inRange(effectiveDate, from, to)) continue;
    recordLoan(
      loanMap,
      {
        currency: obligation.currency,
        date: effectiveDate,
        entity: obligation.entityId,
        metric: "taken",
        amount: obligation.totalDue,
      },
      groupBy,
      timezone,
    );
  }

  for (const loan of loanTransactions) {
    const metric =
      loan.type === "loan_given"
        ? "given"
        : loan.type === "loan_received"
          ? "taken"
          : loan.type === "repayment_made"
            ? "repaymentsMade"
            : "repaymentsReceived";
    recordLoan(
      loanMap,
      {
        currency: loan.currency,
        date: loan.date,
        entity: loan.entityId,
        metric,
        amount: loan.amount,
      },
      groupBy,
      timezone,
    );
  }

  for (const payment of paymentBacks) {
    recordLoan(
      loanMap,
      {
        currency: payment.currency,
        date: payment.date,
        entity: payment.entityId,
        metric: "repaymentsMade",
        amount: payment.totalAmount,
      },
      groupBy,
      timezone,
    );
  }

  const incomeExpense = [...incomeExpenseMap.entries()]
    .map(([currency, value]) => ({
      currency,
      income: value.income,
      expense: value.expense,
      net: value.income - value.expense,
      incomeCategories: [...value.incomeCategories.values()].sort(
        (a, b) => b.amount - a.amount,
      ),
      expenseCategories: [...value.expenseCategories.values()].sort(
        (a, b) => b.amount - a.amount,
      ),
      series: buckets.map(({ bucket, label }) =>
        value.series.get(bucket) ?? {
          bucket,
          label,
          income: 0,
          expense: 0,
        },
      ),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const loans = [...loanMap.entries()]
    .map(([currency, value]) => ({
      currency,
      taken: value.taken,
      given: value.given,
      repaymentsMade: value.repaymentsMade,
      repaymentsReceived: value.repaymentsReceived,
      byEntity: [...value.byEntity.values()].sort((a, b) => {
        const aTotal = a.taken + a.given + a.repaymentsMade + a.repaymentsReceived;
        const bTotal = b.taken + b.given + b.repaymentsMade + b.repaymentsReceived;
        return bTotal - aTotal;
      }),
      series: buckets.map(({ bucket, label }) =>
        value.series.get(bucket) ?? {
          bucket,
          label,
          taken: 0,
          given: 0,
          repaymentsMade: 0,
          repaymentsReceived: 0,
        },
      ),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      timezone,
    },
    incomeExpense,
    loans,
  };
}
