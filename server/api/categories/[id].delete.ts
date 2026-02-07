import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionCategory, akahuTransaction } from "#db/schema";
import { eq } from "drizzle-orm";

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

    // Get ID from route params
    const id = getRouterParam(event, "id");

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Category ID is required",
      });
    }

    const db = useDrizzle();

    // Verify category exists and belongs to user
    const categories = await db
      .select()
      .from(transactionCategory)
      .where(eq(transactionCategory.id, id));

    const category = categories[0];

    if (!category || category.userId !== session.user.id) {
      throw createError({
        statusCode: 404,
        message: "Category not found",
      });
    }

    // First, unassign all transactions from this category
    await db
      .update(akahuTransaction)
      .set({ categoryId: null })
      .where(eq(akahuTransaction.categoryId, id));

    // Then delete the category
    await db.delete(transactionCategory).where(eq(transactionCategory.id, id));

    return { success: true };
  } catch (error) {
    console.error("Error deleting category:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete category",
    });
  }
});
