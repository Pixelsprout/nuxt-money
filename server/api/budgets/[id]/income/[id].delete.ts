import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budgetIncome } from "#db/schema";
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

  const incomeId = getRouterParam(event, "id");

  if (!incomeId) {
    throw createError({
      statusCode: 400,
      message: "Income ID is required",
    });
  }

  const db = useDrizzle();

  try {
    // Delete with ownership check
    const deletedIncome = await db
      .delete(budgetIncome)
      .where(
        and(eq(budgetIncome.id, incomeId), eq(budgetIncome.userId, session.user.id))
      )
      .returning();

    if (deletedIncome.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Income source not found",
      });
    }

    return {
      success: true,
      message: "Income source deleted successfully",
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/income] Error deleting income:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete income source",
    });
  }
});
