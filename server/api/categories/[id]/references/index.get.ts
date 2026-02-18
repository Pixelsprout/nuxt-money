import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionReference, transactionCategory } from "#db/schema";
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

  const categoryId = getRouterParam(event, "id");

  if (!categoryId) {
    throw createError({
      statusCode: 400,
      message: "Category ID is required",
    });
  }

  const db = useDrizzle();

  try {
    // Verify category ownership
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

    // Fetch references for this category
    const references = await db
      .select()
      .from(transactionReference)
      .where(
        and(
          eq(transactionReference.categoryId, categoryId),
          eq(transactionReference.userId, session.user.id),
        ),
      );

    return {
      success: true,
      references,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;

    console.error("[categories/references] Error:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch references",
    });
  }
});
