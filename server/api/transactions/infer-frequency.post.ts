import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { akahuTransaction } from "#db/schema";
import { eq, and, desc, like, or } from "drizzle-orm";

/**
 * Infer the frequency of a recurring transaction based on historical data.
 * Analyzes transaction history to detect patterns like weekly, fortnightly, monthly payments.
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

  const body = await readBody(event);
  const { transactionId, merchant, description } = body;

  if (!transactionId && !merchant && !description) {
    throw createError({
      statusCode: 400,
      message:
        "Provide either transactionId, merchant, or description to match against",
    });
  }

  const db = useDrizzle();

  try {
    let matchingTransactions;

    if (transactionId) {
      // Get the reference transaction first
      const refTransaction = await db
        .select()
        .from(akahuTransaction)
        .where(
          and(
            eq(akahuTransaction.id, transactionId),
            eq(akahuTransaction.userId, session.user.id)
          )
        );

      if (refTransaction.length === 0) {
        throw createError({
          statusCode: 404,
          message: "Transaction not found",
        });
      }

      const ref = refTransaction[0];

      // Find similar transactions by merchant or description
      matchingTransactions = await db
        .select()
        .from(akahuTransaction)
        .where(
          and(
            eq(akahuTransaction.userId, session.user.id),
            or(
              ref.merchant ? eq(akahuTransaction.merchant, ref.merchant) : undefined,
              like(akahuTransaction.description, `%${ref.description.slice(0, 20)}%`)
            )
          )
        )
        .orderBy(desc(akahuTransaction.date))
        .limit(20);
    } else {
      // Search by provided merchant or description
      const conditions = [eq(akahuTransaction.userId, session.user.id)];

      if (merchant) {
        conditions.push(like(akahuTransaction.merchant, `%${merchant}%`));
      }
      if (description) {
        conditions.push(like(akahuTransaction.description, `%${description}%`));
      }

      matchingTransactions = await db
        .select()
        .from(akahuTransaction)
        .where(and(...conditions))
        .orderBy(desc(akahuTransaction.date))
        .limit(20);
    }

    if (matchingTransactions.length < 2) {
      return {
        success: true,
        frequency: null,
        confidence: 0,
        message: "Not enough transactions to infer frequency",
        matchCount: matchingTransactions.length,
      };
    }

    // Calculate intervals between transactions
    const intervals: number[] = [];
    for (let i = 0; i < matchingTransactions.length - 1; i++) {
      const current = new Date(matchingTransactions[i].date);
      const previous = new Date(matchingTransactions[i + 1].date);
      const daysDiff = Math.round(
        (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)
      );
      intervals.push(daysDiff);
    }

    // Calculate average interval
    const avgInterval =
      intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

    // Determine frequency based on average interval
    let frequency: string;
    let confidence: number;

    if (avgInterval >= 5 && avgInterval <= 9) {
      frequency = "WEEKLY";
      confidence = Math.max(0, 100 - Math.abs(avgInterval - 7) * 15);
    } else if (avgInterval >= 12 && avgInterval <= 16) {
      frequency = "FORTNIGHTLY";
      confidence = Math.max(0, 100 - Math.abs(avgInterval - 14) * 10);
    } else if (avgInterval >= 25 && avgInterval <= 35) {
      frequency = "MONTHLY";
      confidence = Math.max(0, 100 - Math.abs(avgInterval - 30) * 5);
    } else if (avgInterval >= 80 && avgInterval <= 100) {
      frequency = "QUARTERLY";
      confidence = Math.max(0, 100 - Math.abs(avgInterval - 90) * 2);
    } else if (avgInterval >= 350 && avgInterval <= 380) {
      frequency = "YEARLY";
      confidence = Math.max(0, 100 - Math.abs(avgInterval - 365) * 1);
    } else {
      frequency = "MONTHLY"; // Default fallback
      confidence = 20;
    }

    // Calculate suggested next due date
    const lastTransaction = matchingTransactions[0];
    const lastDate = new Date(lastTransaction.date);
    let nextDueDate: Date;

    switch (frequency) {
      case "WEEKLY":
        nextDueDate = new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case "FORTNIGHTLY":
        nextDueDate = new Date(lastDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case "MONTHLY":
        nextDueDate = new Date(lastDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        break;
      case "QUARTERLY":
        nextDueDate = new Date(lastDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 3);
        break;
      case "YEARLY":
        nextDueDate = new Date(lastDate);
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
        break;
      default:
        nextDueDate = new Date(lastDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    }

    // Get average amount
    const amounts = matchingTransactions.map((t) => Math.abs(t.amount?.value || 0));
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;

    return {
      success: true,
      frequency,
      confidence: Math.round(confidence),
      avgInterval: Math.round(avgInterval),
      matchCount: matchingTransactions.length,
      avgAmount: Math.round(avgAmount * 100), // Convert to cents
      nextDueDate: nextDueDate.toISOString(),
      matchPattern: {
        merchant: matchingTransactions[0].merchant,
        description: matchingTransactions[0].description,
      },
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[transactions] Error inferring frequency:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to infer transaction frequency",
    });
  }
});
