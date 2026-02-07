import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionCategory, akahuTransaction } from "#db/schema";
import { eq, and, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  try {
    // Auth check
    const session = await auth.api.getSession({
      headers: event.node.req.headers as Record<string, string>,
    });

    if (!session?.user) {
      throw createError({
        statusCode: 401,
        message: "Unauthorized",
      });
    }

    // Get category ID from route params
    const categoryId = getRouterParam(event, "id");

    if (!categoryId) {
      throw createError({
        statusCode: 400,
        message: "Category ID is required",
      });
    }

    const db = useDrizzle();

    // First verify category ownership (exists and belongs to user)
    const categories = await db
      .select()
      .from(transactionCategory)
      .where(
        and(
          eq(transactionCategory.id, categoryId),
          eq(transactionCategory.userId, session.user.id),
        ),
      )
      .limit(1);

    if (categories.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Category not found",
      });
    }

    // Query transactions for this category
    const transactions = await db
      .select()
      .from(akahuTransaction)
      .where(eq(akahuTransaction.categoryId, categoryId))
      .orderBy(desc(akahuTransaction.date));

    return { success: true, transactions };
  } catch (error) {
    console.error("[categories/[id]/transactions.get] Error:", error);

    if (error instanceof H3Error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
