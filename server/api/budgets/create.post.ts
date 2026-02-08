import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budget } from "#db/schema";
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

  const body = await readBody(event);
  const { name, period, periodStart, periodEnd } = body;

  // Validate inputs
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      message: "Budget name is required",
    });
  }

  if (!period || !["MONTHLY", "QUARTERLY", "YEARLY"].includes(period)) {
    throw createError({
      statusCode: 400,
      message: "Period must be MONTHLY, QUARTERLY, or YEARLY",
    });
  }

  if (!periodStart || !periodEnd) {
    throw createError({
      statusCode: 400,
      message: "Period start and end dates are required",
    });
  }

  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw createError({
      statusCode: 400,
      message: "Invalid date format",
    });
  }

  if (startDate >= endDate) {
    throw createError({
      statusCode: 400,
      message: "Period start must be before period end",
    });
  }

  const db = useDrizzle();

  try {
    const budgetId = nanoid();
    console.log("[budgets/create] Creating budget:", {
      id: budgetId,
      name: name.trim(),
      period,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
    });

    const newBudget = await db
      .insert(budget)
      .values({
        id: budgetId,
        userId: session.user.id,
        name: name.trim(),
        period,
        periodStart: startDate,
        periodEnd: endDate,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log(
      "[budgets/create] Budget created successfully:",
      newBudget[0].id,
    );

    return {
      success: true,
      budget: newBudget[0],
    };
  } catch (error: any) {
    console.error("[budgets/create] Error creating budget:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create budget",
    });
  }
});
