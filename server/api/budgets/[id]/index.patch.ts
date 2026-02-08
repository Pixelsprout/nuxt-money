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

  const body = await readBody(event);
  const { name, period, periodStart, periodEnd, status } = body;

  const db = useDrizzle();

  try {
    // Verify ownership
    const existingBudget = await db
      .select()
      .from(budget)
      .where(and(eq(budget.id, budgetId), eq(budget.userId, session.user.id)));

    if (existingBudget.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Budget not found",
      });
    }

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        throw createError({
          statusCode: 400,
          message: "Budget name cannot be empty",
        });
      }
      updateData.name = name.trim();
    }

    if (period !== undefined) {
      if (!["MONTHLY", "QUARTERLY", "YEARLY"].includes(period)) {
        throw createError({
          statusCode: 400,
          message: "Period must be MONTHLY, QUARTERLY, or YEARLY",
        });
      }
      updateData.period = period;
    }

    if (periodStart !== undefined) {
      const startDate = new Date(periodStart);
      if (isNaN(startDate.getTime())) {
        throw createError({
          statusCode: 400,
          message: "Invalid period start date",
        });
      }
      updateData.periodStart = startDate;
    }

    if (periodEnd !== undefined) {
      const endDate = new Date(periodEnd);
      if (isNaN(endDate.getTime())) {
        throw createError({
          statusCode: 400,
          message: "Invalid period end date",
        });
      }
      updateData.periodEnd = endDate;
    }

    if (status !== undefined) {
      if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) {
        throw createError({
          statusCode: 400,
          message: "Status must be DRAFT, ACTIVE, or ARCHIVED",
        });
      }
      updateData.status = status;
    }

    const updatedBudget = await db
      .update(budget)
      .set(updateData)
      .where(eq(budget.id, budgetId))
      .returning();

    return {
      success: true,
      budget: updatedBudget[0],
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets] Error updating budget:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update budget",
    });
  }
});
