import { useDrizzle } from "#utils/drizzle";
import { fixedExpense, fixedExpenseTransaction, akahuTransaction } from "#db/schema";
import { eq, desc } from "drizzle-orm";

type Frequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

interface DueDateConfig {
  frequency: Frequency;
  lastPaymentDate: Date;
  adjustForWeekends?: boolean;
}

/**
 * Calculate next due date from last payment date + frequency
 */
export function calculateNextDueDate(config: DueDateConfig): Date {
  const { frequency, lastPaymentDate, adjustForWeekends = false } = config;
  const next = new Date(lastPaymentDate);

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
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
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
 * Update next due date for a fixed expense based on last tagged transaction
 */
export async function updateNextDueDate(fixedExpenseId: string): Promise<void> {
  const db = useDrizzle();

  // Get expense details
  const expense = await db.query.fixedExpense.findFirst({
    where: eq(fixedExpense.id, fixedExpenseId),
  });

  if (!expense) return;

  // Get last tagged transaction
  const lastTransaction = await db
    .select()
    .from(fixedExpenseTransaction)
    .innerJoin(
      akahuTransaction,
      eq(fixedExpenseTransaction.transactionId, akahuTransaction.id)
    )
    .where(eq(fixedExpenseTransaction.fixedExpenseId, fixedExpenseId))
    .orderBy(desc(akahuTransaction.date))
    .limit(1);

  if (lastTransaction.length === 0) {
    // No transactions tagged yet, clear next due date
    await db
      .update(fixedExpense)
      .set({ nextDueDate: null })
      .where(eq(fixedExpense.id, fixedExpenseId));
    return;
  }

  // Calculate next due date from last transaction
  const lastDate = new Date(lastTransaction[0].akahu_transaction.date);
  const next = calculateNextDueDate({
    frequency: expense.frequency as Frequency,
    lastPaymentDate: lastDate,
    adjustForWeekends: false, // Could be made configurable in future
  });

  await db
    .update(fixedExpense)
    .set({ nextDueDate: next })
    .where(eq(fixedExpense.id, fixedExpenseId));
}
