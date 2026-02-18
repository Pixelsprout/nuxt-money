import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionReference } from "#db/schema";
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

  const refId = getRouterParam(event, "refId");

  if (!refId) {
    throw createError({
      statusCode: 400,
      message: "Reference ID is required",
    });
  }

  const db = useDrizzle();

  try {
    // Verify reference ownership
    const references = await db
      .select()
      .from(transactionReference)
      .where(
        and(
          eq(transactionReference.id, refId),
          eq(transactionReference.userId, session.user.id),
        ),
      )
      .limit(1);

    if (references.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Reference not found",
      });
    }

    await db
      .delete(transactionReference)
      .where(eq(transactionReference.id, refId));

    return {
      success: true,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;

    console.error("[categories/references] Error deleting:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete reference",
    });
  }
});
