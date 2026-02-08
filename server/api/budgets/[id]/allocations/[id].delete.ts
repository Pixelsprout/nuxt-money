import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { categoryAllocation, budget } from "#db/schema";
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
  const allocationId = getRouterParam(event, "id");

  if (!allocationId) {
    throw createError({
      statusCode: 400,
      message: "Allocation ID is required",
    });
  }

  const db = useDrizzle();

  try {
    // Verify budget ownership
    const budgetResult = await db
      .select()
      .from(budget)
      .where(and(eq(budget.id, budgetId!), eq(budget.userId, session.user.id)));

    if (budgetResult.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Budget not found",
      });
    }

    // Delete allocation
    const deletedAllocation = await db
      .delete(categoryAllocation)
      .where(
        and(
          eq(categoryAllocation.id, allocationId),
          eq(categoryAllocation.budgetId, budgetId!)
        )
      )
      .returning();

    if (deletedAllocation.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Allocation not found",
      });
    }

    return {
      success: true,
      message: "Allocation deleted successfully",
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/allocations] Error deleting allocation:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete allocation",
    });
  }
});
