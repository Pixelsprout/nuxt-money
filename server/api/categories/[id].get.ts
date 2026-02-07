import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionCategory, akahuTransaction } from "#db/schema";
import { eq, and, sql } from "drizzle-orm";

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

    // Fetch category with transaction count
    const [categoryResult] = await db
      .select({
        category: transactionCategory,
        transactionCount: sql<number>`cast(count(${akahuTransaction.id}) as integer)`,
      })
      .from(transactionCategory)
      .leftJoin(
        akahuTransaction,
        and(
          eq(akahuTransaction.categoryId, transactionCategory.id),
          eq(akahuTransaction.userId, session.user.id)
        )
      )
      .where(
        and(
          eq(transactionCategory.id, categoryId),
          eq(transactionCategory.userId, session.user.id)
        )
      )
      .groupBy(transactionCategory.id);

    if (!categoryResult) {
      throw createError({
        statusCode: 404,
        message: "Category not found",
      });
    }

    return {
      success: true,
      category: categoryResult.category,
      transactionCount: categoryResult.transactionCount,
    };
  } catch (error) {
    console.error("[categories/[id].get] Error:", error);

    if (error instanceof H3Error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
