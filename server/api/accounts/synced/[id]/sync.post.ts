import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { akahuAccount } from "#db/schema";
import { getAkahuClient, getAkahuUserToken } from "#root/server/utils/akahu";
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

  // Get account ID from URL parameter
  const accountId = getRouterParam(event, "id");

  if (!accountId) {
    throw createError({
      statusCode: 400,
      message: "Account ID is required",
    });
  }

  const db = useDrizzle();

  try {
    // Fetch the account from database
    const existingAccounts = await db
      .select()
      .from(akahuAccount)
      .where(
        and(
          eq(akahuAccount.id, accountId),
          eq(akahuAccount.userId, session.user.id)
        )
      )
      .limit(1);

    if (existingAccounts.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Account not found",
      });
    }

    const existingAccount = existingAccounts[0];

    // Fetch fresh data from Akahu API
    const akahuClient = getAkahuClient();
    const userToken = getAkahuUserToken();
    const allAccounts = await akahuClient.accounts.list(userToken);

    // Find the specific account by Akahu ID
    const freshAccount = allAccounts.find(
      (account: any) => account._id === existingAccount.akahuId
    );

    if (!freshAccount) {
      throw createError({
        statusCode: 404,
        message: "Account not found in Akahu",
      });
    }

    // Update the account in database
    const updated = await db
      .update(akahuAccount)
      .set({
        name: freshAccount.name,
        type: freshAccount.type,
        formattedAccount: freshAccount.formatted_account || null,
        balance: freshAccount.balance || null,
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(akahuAccount.id, accountId))
      .returning();

    return {
      success: true,
      account: updated[0],
    };
  } catch (error: any) {
    console.error("[akahu] Error syncing account:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to sync account",
    });
  }
});
