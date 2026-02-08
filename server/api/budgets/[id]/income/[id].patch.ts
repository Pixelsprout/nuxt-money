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

  const body = await readBody(event);
  const { name, amount, frequency, notes } = body;

  const db = useDrizzle();

  try {
    // Verify ownership
    const existingIncome = await db
      .select()
      .from(budgetIncome)
      .where(
        and(eq(budgetIncome.id, incomeId), eq(budgetIncome.userId, session.user.id))
      );

    if (existingIncome.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Income source not found",
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
          message: "Income name cannot be empty",
        });
      }
      updateData.name = name.trim();
    }

    if (amount !== undefined) {
      if (typeof amount !== "number" || amount <= 0) {
        throw createError({
          statusCode: 400,
          message: "Amount must be a positive number",
        });
      }
      updateData.amount = Math.round(amount);
    }

    if (frequency !== undefined) {
      if (!["WEEKLY", "FORTNIGHTLY", "MONTHLY"].includes(frequency)) {
        throw createError({
          statusCode: 400,
          message: "Frequency must be WEEKLY, FORTNIGHTLY, or MONTHLY",
        });
      }
      updateData.frequency = frequency;
    }

    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    const updatedIncome = await db
      .update(budgetIncome)
      .set(updateData)
      .where(eq(budgetIncome.id, incomeId))
      .returning();

    return {
      success: true,
      income: updatedIncome[0],
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/income] Error updating income:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update income source",
    });
  }
});
