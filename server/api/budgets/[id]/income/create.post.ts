import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budget, budgetIncome } from "#db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

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

  const budgetId = getRouterParam(event, "id");

  if (!budgetId) {
    throw createError({
      statusCode: 400,
      message: "Budget ID is required",
    });
  }

  const body = await readBody(event);
  const { name, amount, frequency, notes } = body;

  // Validate inputs
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      message: "Income name is required",
    });
  }

  if (typeof amount !== "number" || amount <= 0) {
    throw createError({
      statusCode: 400,
      message: "Amount must be a positive number",
    });
  }

  if (!frequency || !["WEEKLY", "FORTNIGHTLY", "MONTHLY"].includes(frequency)) {
    throw createError({
      statusCode: 400,
      message: "Frequency must be WEEKLY, FORTNIGHTLY, or MONTHLY",
    });
  }

  const db = useDrizzle();

  try {
    // Verify budget ownership
    const budgetResult = await db
      .select()
      .from(budget)
      .where(and(eq(budget.id, budgetId), eq(budget.userId, session.user.id)));

    if (budgetResult.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Budget not found",
      });
    }

    // Create income source
    const newIncome = await db
      .insert(budgetIncome)
      .values({
        id: nanoid(),
        budgetId,
        userId: session.user.id,
        name: name.trim(),
        amount: Math.round(amount), // Store in cents
        frequency,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      income: newIncome[0],
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/income] Error creating income:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create income source",
    });
  }
});
