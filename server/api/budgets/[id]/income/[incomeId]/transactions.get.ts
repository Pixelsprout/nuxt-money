import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  budgetIncome,
  akahuTransaction,
  budgetIncomeTransaction,
} from "#db/schema";
import { eq, and, desc } from "drizzle-orm";

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

    // Fetch all tagged transactions
    const taggedTransactions = await db
      .select()
      .from(budgetIncomeTransaction)
      .innerJoin(
        akahuTransaction,
        eq(budgetIncomeTransaction.transactionId, akahuTransaction.id)
      )
      .where(eq(budgetIncomeTransaction.incomeId, incomeId))
      .orderBy(desc(akahuTransaction.date));

    // Calculate summary statistics
    const totalTagged = taggedTransactions.length;
    const totalAmount = taggedTransactions.reduce((sum, row) => {
      const amount =
        row.akahu_transaction.amount &&
        typeof row.akahu_transaction.amount === "object" &&
        "value" in row.akahu_transaction.amount
          ? (row.akahu_transaction.amount.value as number)
          : 0;
      return sum + amount;
    }, 0);

    const averageAmount = totalTagged > 0 ? totalAmount / totalTagged : 0;

    const lastPayday =
      taggedTransactions.length > 0
        ? taggedTransactions[0].akahu_transaction.date
        : null;

    const nextPayday = income.nextPaydayDate || null;

    // Format transactions for response
    const transactions = taggedTransactions.map((row) => ({
      id: row.budget_income_transaction.id,
      transaction: row.akahu_transaction,
      linkedAt: row.budget_income_transaction.linkedAt,
      fromAccount: row.budget_income_transaction.fromAccount,
      autoTagged: row.budget_income_transaction.autoTagged,
    }));

    return {
      income: income,
      transactions: transactions,
      summary: {
        totalTagged,
        totalAmount,
        averageAmount,
        lastPayday,
        nextPayday,
      },
    };
  } catch (error: any) {
    console.error("[income] Error fetching tagged transactions:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch tagged transactions",
    });
  }
});
