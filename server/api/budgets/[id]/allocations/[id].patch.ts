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

  const body = await readBody(event);
  const { allocatedAmount, notes } = body;

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

    // Verify allocation exists and belongs to this budget
    const existingAllocation = await db
      .select()
      .from(categoryAllocation)
      .where(
        and(
          eq(categoryAllocation.id, allocationId),
          eq(categoryAllocation.budgetId, budgetId!)
        )
      );

    if (existingAllocation.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Allocation not found",
      });
    }

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (allocatedAmount !== undefined) {
      if (typeof allocatedAmount !== "number" || allocatedAmount < 0) {
        throw createError({
          statusCode: 400,
          message: "Allocated amount must be a non-negative number",
        });
      }
      updateData.allocatedAmount = Math.round(allocatedAmount);
    }

    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    const updatedAllocation = await db
      .update(categoryAllocation)
      .set(updateData)
      .where(eq(categoryAllocation.id, allocationId))
      .returning();

    return {
      success: true,
      allocation: updatedAllocation[0],
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/allocations] Error updating allocation:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update allocation",
    });
  }
});
