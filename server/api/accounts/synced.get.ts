import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { akahuAccount } from "#db/schema";
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
    // Query synced accounts for the current user
    const accounts = await db
      .select()
      .from(akahuAccount)
      .where(eq(akahuAccount.userId, session.user.id));

    return {
      success: true,
      accounts,
    };
  } catch (error: any) {
    console.error("[akahu] Error fetching synced accounts:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch synced accounts",
    });
  }
});
