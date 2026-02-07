import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionCategory } from "#db/schema";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  // Validate session
  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  // Read request body
  const body = await readBody(event);
  const { name, color, description } = body;

  // Validate inputs
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      message: "Category name is required",
    });
  }

  if (name.trim().length > 100) {
    throw createError({
      statusCode: 400,
      message: "Category name must be 100 characters or less",
    });
  }

  const db = useDrizzle();

  try {
    // Create the category
    const newCategory = await db
      .insert(transactionCategory)
      .values({
        id: nanoid(),
        userId: session.user.id,
        name: name.trim(),
        color: color || "neutral",
        description: description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      category: newCategory[0],
    };
  } catch (error: any) {
    console.error("[categories] Error creating category:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create category",
    });
  }
});
