import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  budgetIncome,
  akahuTransaction,
  budgetIncomeTransaction,
  akahuAccount,
} from "#db/schema";
import { updateNextPayday } from "#root/server/utils/payday-calculator";
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
  const incomeId = getRouterParam(event, "incomeId");

  if (!budgetId || !incomeId) {
    throw createError({
      statusCode: 400,
      message: "Budget ID and Income ID are required",
    });
  }

  // Get request body
  const body = await readBody(event);
  const { transactionId, referenceDatePayday } = body;

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

    // Verify transaction ownership (through account)
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
      .from(budgetIncomeTransaction)
      .where(
        and(
          eq(budgetIncomeTransaction.incomeId, incomeId),
          eq(budgetIncomeTransaction.transactionId, transactionId)
        )
      )
      .limit(1);

    if (existingLink.length > 0) {
      throw createError({
        statusCode: 409,
        message: "Transaction is already tagged to this income item",
      });
    }

    // Extract fromAccount from transaction.meta.other_account
    const fromAccount =
      transaction.meta &&
      typeof transaction.meta === "object" &&
      "other_account" in transaction.meta
        ? (transaction.meta.other_account as string)
        : null;

    // Create budgetIncomeTransaction entry
    await db.insert(budgetIncomeTransaction).values({
      id: nanoid(),
      incomeId: incomeId,
      transactionId: transactionId,
      fromAccount: fromAccount,
      autoTagged: false,
    });

    // Update income settings
    const incomeUpdates: any = {};

    // Set expectedFromAccount if not already set and we have a fromAccount
    if (!income.expectedFromAccount && fromAccount) {
      incomeUpdates.expectedFromAccount = fromAccount;
    }

    // Set referenceDatePayday if provided
    if (referenceDatePayday) {
      incomeUpdates.referenceDatePayday = new Date(referenceDatePayday);
    }

    // Update income if there are changes
    if (Object.keys(incomeUpdates).length > 0) {
      await db
        .update(budgetIncome)
        .set(incomeUpdates)
        .where(eq(budgetIncome.id, incomeId));
    }

    // Calculate and update next payday
    await updateNextPayday(incomeId);

    // Fetch updated income
    const updatedIncome = await db.query.budgetIncome.findFirst({
      where: eq(budgetIncome.id, incomeId),
    });

    return {
      success: true,
      income: updatedIncome,
      transaction: transaction,
      fromAccount: fromAccount,
    };
  } catch (error: any) {
    console.error("[income] Error tagging transaction:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to tag transaction",
    });
  }
});
