import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  budgetIncome,
  akahuTransaction,
  budgetIncomeTransaction,
} from "#db/schema";
import { eq, and, asc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  // Validate session
  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const budgetId = getRouterParam(event, "id");
  const incomeId = getRouterParam(event, "incomeId");

  if (!budgetId || !incomeId) {
    throw createError({
      statusCode: 400,
      message: "Budget ID and Income ID are required",
    });
  }

  const db = useDrizzle();

  try {
    // Verify budget ownership
    const budgetRecord = await db.query.budget.findFirst({
      where: and(eq(budget.id, budgetId), eq(budget.userId, session.user.id)),
    });

    if (!budgetRecord) {
      throw createError({
        statusCode: 404,
        message: "Budget not found or access denied",
      });
    }

    // Verify income ownership (through budget)
    const income = await db.query.budgetIncome.findFirst({
      where: and(
        eq(budgetIncome.id, incomeId),
        eq(budgetIncome.budgetId, budgetId),
        eq(budgetIncome.userId, session.user.id)
      ),
    });

    if (!income) {
      throw createError({
        statusCode: 404,
        message: "Income item not found or access denied",
      });
    }

    // Fetch all tagged transactions ordered by date
    const taggedTransactions = await db
      .select()
      .from(budgetIncomeTransaction)
      .innerJoin(
        akahuTransaction,
        eq(budgetIncomeTransaction.transactionId, akahuTransaction.id)
      )
      .where(eq(budgetIncomeTransaction.incomeId, incomeId))
      .orderBy(asc(akahuTransaction.date));

    // Need at least 2 transactions to infer frequency
    if (taggedTransactions.length < 2) {
      return {
        suggested: null,
        confidence: "low",
        sampleSize: taggedTransactions.length,
        message: "Need at least 2 transactions to infer frequency",
      };
    }

    // Calculate intervals between consecutive transactions (in days)
    const intervals: number[] = [];
    for (let i = 1; i < taggedTransactions.length; i++) {
      const prevDate = new Date(taggedTransactions[i - 1].akahu_transaction.date);
      const currDate = new Date(taggedTransactions[i].akahu_transaction.date);
      const diffMs = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      intervals.push(diffDays);
    }

    // Calculate average interval
    const avgInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

    // Determine frequency based on average interval
    let suggestedFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | null = null;
    let confidence: "high" | "medium" | "low" = "low";

    // Weekly: ~7 days (±3 days tolerance)
    if (avgInterval >= 4 && avgInterval <= 10) {
      suggestedFrequency = "WEEKLY";
    }
    // Fortnightly: ~14 days (±5 days tolerance)
    else if (avgInterval >= 9 && avgInterval <= 19) {
      suggestedFrequency = "FORTNIGHTLY";
    }
    // Monthly: ~30 days (±8 days tolerance)
    else if (avgInterval >= 22 && avgInterval <= 38) {
      suggestedFrequency = "MONTHLY";
    }

    // Calculate confidence based on consistency of intervals
    if (suggestedFrequency) {
      const variance =
        intervals.reduce((sum, interval) => {
          const diff = interval - avgInterval;
          return sum + diff * diff;
        }, 0) / intervals.length;

      const stdDev = Math.sqrt(variance);

      // High confidence: low standard deviation relative to average
      if (stdDev < avgInterval * 0.1) {
        confidence = "high";
      }
      // Medium confidence: moderate standard deviation
      else if (stdDev < avgInterval * 0.25) {
        confidence = "medium";
      }
      // Low confidence: high standard deviation
      else {
        confidence = "low";
      }

      // Boost confidence if we have more samples
      if (taggedTransactions.length >= 5 && confidence === "medium") {
        confidence = "high";
      } else if (taggedTransactions.length >= 3 && confidence === "low") {
        confidence = "medium";
      }
    }

    return {
      suggested: suggestedFrequency,
      confidence,
      sampleSize: taggedTransactions.length,
      averageInterval: Math.round(avgInterval),
      intervals,
    };
  } catch (error: any) {
    console.error("[income] Error inferring frequency:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to infer frequency",
    });
  }
});
