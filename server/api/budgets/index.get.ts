import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budget } from "#db/schema";
import { eq, desc } from "drizzle-orm";

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

  const db = useDrizzle();

  try {
    const budgets = await db
      .select()
      .from(budget)
      .where(eq(budget.userId, session.user.id))
      .orderBy(desc(budget.createdAt));

    return {
      success: true,
      budgets,
    };
  } catch (error: any) {
    console.error("[budgets] Error fetching budgets:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch budgets",
    });
  }
});
