import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionCategory } from "#db/schema";
import { eq, and } from "drizzle-orm";
import { H3Error } from "h3";

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

    // Read request body
    const body = await readBody(event);
    const { name, color, description } = body;

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        throw createError({
          statusCode: 400,
          message: "Category name must be a non-empty string",
        });
      }

      if (name.trim().length > 100) {
        throw createError({
          statusCode: 400,
          message: "Category name must be 100 characters or less",
        });
      }
    }

    const db = useDrizzle();

    // First verify the category exists and belongs to the user
    const [existingCategory] = await db
      .select()
      .from(transactionCategory)
      .where(
        and(
          eq(transactionCategory.id, categoryId),
          eq(transactionCategory.userId, session.user.id),
        ),
      );

    if (!existingCategory) {
      throw createError({
        statusCode: 404,
        message: "Category not found",
      });
    }

    // Build update object with only provided fields
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (color !== undefined) {
      updateData.color = color;
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    // Update the category
    const updated = await db
      .update(transactionCategory)
      .set(updateData)
      .where(eq(transactionCategory.id, categoryId))
      .returning();

    return {
      success: true,
      category: updated[0],
    };
  } catch (error: any) {
    console.error("[categories/[id].patch] Error updating category:", error);

    if (error instanceof H3Error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: "Failed to update category",
    });
  }
});
