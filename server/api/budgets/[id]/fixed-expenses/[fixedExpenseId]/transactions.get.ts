import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  fixedExpense,
  akahuTransaction,
  fixedExpenseTransaction,
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
  const fixedExpenseId = getRouterParam(event, "fixedExpenseId");

  if (!budgetId || !fixedExpenseId) {
    throw createError({
      statusCode: 400,
      message: "Budget ID and Fixed Expense ID are required",
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

    // Verify expense ownership (through budget)
    const expense = await db.query.fixedExpense.findFirst({
      where: and(
        eq(fixedExpense.id, fixedExpenseId),
        eq(fixedExpense.budgetId, budgetId),
        eq(fixedExpense.userId, session.user.id)
      ),
    });

    if (!expense) {
      throw createError({
        statusCode: 404,
        message: "Fixed expense not found or access denied",
      });
    }

    // Fetch all tagged transactions
    const taggedTransactions = await db
      .select()
      .from(fixedExpenseTransaction)
      .innerJoin(
        akahuTransaction,
        eq(fixedExpenseTransaction.transactionId, akahuTransaction.id)
      )
      .where(eq(fixedExpenseTransaction.fixedExpenseId, fixedExpenseId))
      .orderBy(desc(akahuTransaction.date));

    // Calculate summary statistics
    const totalTagged = taggedTransactions.length;
    const totalAmount = taggedTransactions.reduce((sum, row) => {
      const amount =
        row.akahu_transaction.amount &&
        typeof row.akahu_transaction.amount === "object" &&
        "value" in row.akahu_transaction.amount
          ? Math.abs(row.akahu_transaction.amount.value as number)
          : 0;
      return sum + amount;
    }, 0);

    const averageAmount = totalTagged > 0 ? totalAmount / totalTagged : 0;

    const lastPaymentDate =
      taggedTransactions.length > 0
        ? taggedTransactions[0].akahu_transaction.date
        : null;

    const nextDueDate = expense.nextDueDate || null;

    // Format transactions for response
    const transactions = taggedTransactions.map((row) => ({
      id: row.fixed_expense_transaction.id,
      transaction: row.akahu_transaction,
      linkedAt: row.fixed_expense_transaction.linkedAt,
      autoTagged: row.fixed_expense_transaction.autoTagged,
    }));

    return {
      expense: expense,
      transactions: transactions,
      summary: {
        totalTagged,
        totalAmount,
        averageAmount,
        lastPaymentDate,
        nextDueDate,
      },
    };
  } catch (error: any) {
    console.error("[fixed-expense] Error fetching tagged transactions:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch tagged transactions",
    });
  }
});
