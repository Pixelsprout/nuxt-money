import { useDrizzle } from "#utils/drizzle";
import { budgetIncome, budgetIncomeTransaction, akahuTransaction } from "#db/schema";
import { eq, desc } from "drizzle-orm";

type Frequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

interface PaydayConfig {
  frequency: Frequency;
  lastPayday: Date;
  adjustForWeekends: boolean;
}

/**
 * Calculate next payday from last payment date + frequency
 */
export function calculateNextPayday(config: PaydayConfig): Date {
  const { frequency, lastPayday, adjustForWeekends } = config;
  const next = new Date(lastPayday);

  switch (frequency) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "FORTNIGHTLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
  }

  return adjustForWeekends ? adjustWeekendToFriday(next) : next;
}

/**
 * Move Saturday/Sunday to Friday
 */
function adjustWeekendToFriday(date: Date): Date {
  const day = date.getDay();
  if (day === 6) {
    // Saturday → Friday
    date.setDate(date.getDate() - 1);
  } else if (day === 0) {
    // Sunday → Friday
    date.setDate(date.getDate() - 2);
  }
  return date;
}

/**
 * Update next payday for an income item based on last tagged transaction
 */
export async function updateNextPayday(incomeId: string): Promise<void> {
  const db = useDrizzle();

  // Get income details
  const income = await db.query.budgetIncome.findFirst({
    where: eq(budgetIncome.id, incomeId),
  });

  if (!income) return;

  // Get last tagged transaction
  const lastTransaction = await db
    .select()
    .from(budgetIncomeTransaction)
    .innerJoin(
      akahuTransaction,
      eq(budgetIncomeTransaction.transactionId, akahuTransaction.id)
    )
    .where(eq(budgetIncomeTransaction.incomeId, incomeId))
    .orderBy(desc(akahuTransaction.date))
    .limit(1);

  if (lastTransaction.length === 0) {
    // No transactions tagged yet, use reference date if set
    if (income.referenceDatePayday) {
      const next = calculateNextPayday({
        frequency: income.frequency as Frequency,
        lastPayday: new Date(income.referenceDatePayday),
        adjustForWeekends: income.adjustForWeekends ?? true,
      });

      await db
        .update(budgetIncome)
        .set({ nextPaydayDate: next })
        .where(eq(budgetIncome.id, incomeId));
    }
    return;
  }

  // Calculate next payday from last transaction
  const lastDate = new Date(lastTransaction[0].akahu_transaction.date);
  const next = calculateNextPayday({
    frequency: income.frequency as Frequency,
    lastPayday: lastDate,
    adjustForWeekends: income.adjustForWeekends ?? true,
  });

  await db
    .update(budgetIncome)
    .set({ nextPaydayDate: next })
    .where(eq(budgetIncome.id, incomeId));
}
