import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { akahuAccount } from "#db/schema";
import { getAkahuClient, getAkahuUserToken } from "#root/server/utils/akahu";
import { nanoid } from "nanoid";
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

  // Get request body
  const body = await readBody(event);
  const { accountIds } = body;

  if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: "accountIds must be a non-empty array",
    });
  }

  const db = useDrizzle();

  try {
    // Fetch full account details from Akahu API
    const akahuClient = getAkahuClient();
    const userToken = getAkahuUserToken();
    const allAccounts = await akahuClient.accounts.list(userToken);

    // Filter to only selected accounts
    const selectedAccounts = allAccounts.filter((account: any) =>
      accountIds.includes(account._id),
    );

    if (selectedAccounts.length === 0) {
      throw createError({
        statusCode: 404,
        message: "No matching accounts found",
      });
    }

    // Insert or update accounts in database
    const syncedAccounts = [];
    for (const account of selectedAccounts) {
      const existingAccount = await db
        .select()
        .from(akahuAccount)
        .where(eq(akahuAccount.akahuId, account._id))
        .limit(1);

      if (existingAccount.length > 0) {
        // Update existing account
        const updated = await db
          .update(akahuAccount)
          .set({
            name: account.name,
            type: account.type,
            formattedAccount: account.formatted_account || null,
            balance: account.balance || null,
            syncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(akahuAccount.id, existingAccount[0].id))
          .returning();

        syncedAccounts.push(updated[0]);
      } else {
        // Insert new account
        const inserted = await db
          .insert(akahuAccount)
          .values({
            id: nanoid(),
            userId: session.user.id,
            akahuId: account._id,
            name: account.name,
            type: account.type,
            formattedAccount: account.formatted_account || null,
            balance: account.balance || null,
            syncedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        syncedAccounts.push(inserted[0]);
      }
    }

    return {
      success: true,
      accounts: syncedAccounts,
    };
  } catch (error: any) {
    console.error("[akahu] Error syncing accounts:", error);
    throw createError({
      statusCode: 500,
      message: error.message || "Failed to sync accounts",
    });
  }
});
