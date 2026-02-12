import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  fixedExpense,
  akahuTransaction,
  fixedExpenseTransaction,
} from "#db/schema";
import { updateNextDueDate } from "#root/server/utils/next-due-date-calculator";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

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

  // Get request body
  const body = await readBody(event);
  const { transactionId, referenceDateDueDate } = body;

  if (!transactionId) {
    throw createError({
      statusCode: 400,
      message: "transactionId is required",
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

    // Verify transaction ownership
    const transaction = await db.query.akahuTransaction.findFirst({
      where: and(
        eq(akahuTransaction.id, transactionId),
        eq(akahuTransaction.userId, session.user.id)
      ),
    });

    if (!transaction) {
      throw createError({
        statusCode: 404,
        message: "Transaction not found or access denied",
      });
    }

    // Check if already tagged
    const existingLink = await db
      .select()
      .from(fixedExpenseTransaction)
      .where(
        and(
          eq(fixedExpenseTransaction.fixedExpenseId, fixedExpenseId),
          eq(fixedExpenseTransaction.transactionId, transactionId)
        )
      )
      .limit(1);

    if (existingLink.length > 0) {
      throw createError({
        statusCode: 409,
        message: "Transaction is already tagged to this fixed expense",
      });
    }

    // Create fixedExpenseTransaction entry
    await db.insert(fixedExpenseTransaction).values({
      id: nanoid(),
      fixedExpenseId: fixedExpenseId,
      transactionId: transactionId,
      autoTagged: false,
    });

    // Update expense settings if referenceDateDueDate provided
    if (referenceDateDueDate) {
      await db
        .update(fixedExpense)
        .set({ nextDueDate: new Date(referenceDateDueDate) })
        .where(eq(fixedExpense.id, fixedExpenseId));
    }

    // Calculate and update next due date
    await updateNextDueDate(fixedExpenseId);

    // Fetch updated expense
    const updatedExpense = await db.query.fixedExpense.findFirst({
      where: eq(fixedExpense.id, fixedExpenseId),
    });

    return {
      success: true,
      fixedExpense: updatedExpense,
      transaction: transaction,
    };
  } catch (error: any) {
    console.error("[fixed-expense] Error tagging transaction:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to tag transaction",
    });
  }
});
