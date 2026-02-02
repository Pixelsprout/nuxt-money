import { auth } from "#root/lib/auth";
import { getAkahuClient, getAkahuUserToken } from "#root/server/utils/akahu";

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

    // Return account list with relevant fields
    return {
      success: true,
      accounts: accounts.map((account: any) => ({
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
