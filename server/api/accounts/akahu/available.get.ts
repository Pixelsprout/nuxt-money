import { auth } from "#root/lib/auth";
import { getAkahuClient, getAkahuUserToken } from "#root/server/utils/akahu";
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

  try {
    // Fetch accounts from Akahu API
    const akahuClient = getAkahuClient();
    const userToken = getAkahuUserToken();
    const accounts = await akahuClient.accounts.list(userToken);

    // Fetch already synced accounts from database
    const db = useDrizzle();
    const syncedAccounts = await db
      .select()
      .from(akahuAccount)
      .where(eq(akahuAccount.userId, session.user.id));

    // Create a Set of synced Akahu IDs for efficient lookup
    const syncedAkahuIds = new Set(
      syncedAccounts.map((account) => account.akahuId),
    );

    // Filter out accounts that are already synced
    const unsyncedAccounts = accounts.filter(
      (account: any) => !syncedAkahuIds.has(account._id),
    );

    // Return only unsynced accounts with relevant fields
    return {
      success: true,
      accounts: unsyncedAccounts.map((account: any) => ({
        _id: account._id,
        name: account.name,
        type: account.type,
        balance: account.balance,
        formatted_account: account.formatted_account,
      })),
    };
  } catch (error: any) {
    console.error("[akahu] Error fetching accounts:", error);
    throw createError({
      statusCode: 500,
      message: error.message || "Failed to fetch accounts from Akahu",
    });
  }
});
