import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionCategory, akahuTransaction } from "#db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

/**
 * Get 3-month average debit spending per category, adjusted for budget period.
 *
 * Query params:
 *   periodStart - ISO date string (lookback ends here)
 *   period      - MONTHLY | QUARTERLY | YEARLY
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const query = getQuery(event);
  const periodStartRaw = query.periodStart as string | undefined;
  const period = query.period as string | undefined;

  if (!periodStartRaw || !period) {
    throw createError({
      statusCode: 400,
      message: "periodStart and period are required",
    });
  }

  if (!["MONTHLY", "QUARTERLY", "YEARLY"].includes(period)) {
    throw createError({
      statusCode: 400,
      message: "period must be MONTHLY, QUARTERLY, or YEARLY",
    });
  }

  const lookbackEnd = new Date(periodStartRaw);
  if (isNaN(lookbackEnd.getTime())) {
    throw createError({
      statusCode: 400,
      message: "periodStart must be a valid ISO date string",
    });
  }

  const lookbackStart = new Date(lookbackEnd);
  lookbackStart.setMonth(lookbackStart.getMonth() - 3);

  const db = useDrizzle();

  // Get all user categories
  const categories = await db
    .select()
    .from(transactionCategory)
    .where(eq(transactionCategory.userId, session.user.id));

  // Calculate spending per category in the lookback period
  const suggestions = await Promise.all(
    categories.map(async (category) => {
      const transactions = await db
        .select()
        .from(akahuTransaction)
        .where(
          and(
            eq(akahuTransaction.userId, session.user.id),
            eq(akahuTransaction.categoryId, category.id),
            gte(akahuTransaction.date, lookbackStart),
            lte(akahuTransaction.date, lookbackEnd),
          ),
        );

      // Sum debit spending (negative amounts or DEBIT type). Amounts are stored
      // as dollars in the JSONB field.
      const totalSpending = transactions.reduce((sum, t) => {
        const amount = t.amount?.value || 0;
        if (amount < 0 || t.type === "DEBIT") {
          return sum + Math.abs(amount);
        }
        return sum;
      }, 0);

      const monthlyAverage = totalSpending / 3;

      let suggestedAmount: number;
      switch (period) {
        case "QUARTERLY":
          suggestedAmount = monthlyAverage * 3;
          break;
        case "YEARLY":
          suggestedAmount = monthlyAverage * 12;
          break;
        case "MONTHLY":
        default:
          suggestedAmount = monthlyAverage;
      }

      return {
        categoryId: category.id,
        suggestedAmount: Math.round(suggestedAmount * 100), // cents
      };
    }),
  );

  // Return only categories with spend history, sorted highest first
  const filtered = suggestions
    .filter((s) => s.suggestedAmount > 0)
    .sort((a, b) => b.suggestedAmount - a.suggestedAmount);

  return {
    suggestions: filtered,
  };
});
