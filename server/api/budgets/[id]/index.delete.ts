import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budget } from "#db/schema";
import { eq, and } from "drizzle-orm";

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

  const db = useDrizzle();

  try {
    // Verify ownership and delete
    const deletedBudget = await db
      .delete(budget)
      .where(and(eq(budget.id, budgetId), eq(budget.userId, session.user.id)))
      .returning();

    if (deletedBudget.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Budget not found",
      });
    }

    return {
      success: true,
      message: "Budget deleted successfully",
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets] Error deleting budget:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete budget",
    });
  }
});
