import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budget, categoryAllocation, transactionCategory } from "#db/schema";
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
  const { categoryId, allocatedAmount, notes } = body;

  // Validate inputs
  if (!categoryId) {
    throw createError({
      statusCode: 400,
      message: "Category ID is required",
    });
  }

  if (typeof allocatedAmount !== "number" || allocatedAmount < 0) {
    throw createError({
      statusCode: 400,
      message: "Allocated amount must be a non-negative number",
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

    // Verify category ownership
    const categoryResult = await db
      .select()
      .from(transactionCategory)
      .where(
        and(
          eq(transactionCategory.id, categoryId),
          eq(transactionCategory.userId, session.user.id)
        )
      );

    if (categoryResult.length === 0) {
      throw createError({
        statusCode: 400,
        message: "Category not found",
      });
    }

    // Check if allocation already exists for this category
    const existingAllocation = await db
      .select()
      .from(categoryAllocation)
      .where(
        and(
          eq(categoryAllocation.budgetId, budgetId),
          eq(categoryAllocation.categoryId, categoryId)
        )
      );

    if (existingAllocation.length > 0) {
      throw createError({
        statusCode: 400,
        message: "Allocation for this category already exists",
      });
    }

    // Create allocation
    const newAllocation = await db
      .insert(categoryAllocation)
      .values({
        id: nanoid(),
        budgetId,
        categoryId,
        allocatedAmount: Math.round(allocatedAmount),
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      allocation: newAllocation[0],
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/allocations] Error creating allocation:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create allocation",
    });
  }
});
