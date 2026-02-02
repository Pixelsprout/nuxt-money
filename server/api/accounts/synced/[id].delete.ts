import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { akahuAccount } from "#db/schema";
import { eq, and } from "drizzle-orm";

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

  // Get account ID from route params
  const accountId = getRouterParam(event, "id");

  if (!accountId) {
    throw createError({
      statusCode: 400,
      message: "Account ID is required",
    });
  }

  const db = useDrizzle();

  try {
    // Delete account only if it belongs to the current user
    const result = await db
      .delete(akahuAccount)
      .where(
        and(
          eq(akahuAccount.id, accountId),
          eq(akahuAccount.userId, session.user.id),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Account not found or you don't have permission to delete it",
      });
    }

    return {
      success: true,
      message: "Account deleted successfully",
    };
  } catch (error: any) {
    // Re-throw createError errors
    if (error.statusCode) {
      throw error;
    }

    console.error("[akahu] Error deleting account:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete account",
    });
  }
});
