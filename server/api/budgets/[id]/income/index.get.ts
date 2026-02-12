import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budget, budgetIncome } from "#db/schema";
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

  if (!budgetId) {
    throw createError({
      statusCode: 400,
      message: "Budget ID is required",
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

    // Fetch all income items for this budget
    const incomes = await db
      .select()
      .from(budgetIncome)
      .where(
        and(
          eq(budgetIncome.budgetId, budgetId),
          eq(budgetIncome.userId, session.user.id),
        ),
      );

    return {
      incomes: incomes,
    };
  } catch (error: any) {
    console.error("[income] Error fetching income items:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch income items",
    });
  }
});
