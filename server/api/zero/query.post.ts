import { handleQueryRequest } from "@rocicorp/zero/server";
import { mustGetQuery } from "@rocicorp/zero";
import { schema } from "#root/app/db/zero-schema.gen";
import { queries } from "#root/app/db/zero-queries";
import { auth } from "#root/lib/auth";

export default defineEventHandler(async (event) => {
  // Validate session from forwarded cookies
  const session = await auth.api.getSession({
    headers: event.node.req.headers as Record<string, string>,
  });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const userID = session.user.id;

  const response = await handleQueryRequest(
    (name, args) => {
      const query = mustGetQuery(queries, name);
      return query.fn({ args, ctx: { userID } });
    },
    schema,
    toWebRequest(event),
  );

  if (response[0] === "transformFailed") {
    throw createError({
      statusCode: 400,
      message: response[1].message,
    });
  }

  // Return the full tuple — zero-cache expects ["transformed", [...]]
  return response;
});
