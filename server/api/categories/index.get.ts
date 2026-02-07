import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionCategory } from "#db/schema";
import { eq } from "drizzle-orm";

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

  const db = useDrizzle();

  try {
    // Query categories for the current user
    const categories = await db
      .select()
      .from(transactionCategory)
      .where(eq(transactionCategory.userId, session.user.id));

    return {
      success: true,
      categories,
    };
  } catch (error: any) {
    console.error("[categories] Error fetching categories:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch categories",
    });
  }
});
