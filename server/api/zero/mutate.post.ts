import { handleMutateRequest } from "@rocicorp/zero/server";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { mustGetMutator } from "@rocicorp/zero";
import { schema } from "#root/app/db/zero-schema.gen";
import { mutators } from "#root/app/db/zero-mutators";
import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";

export default defineEventHandler(async (event) => {
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
  const db = useDrizzle();
  const zqlDb = zeroDrizzle(schema, db);

  const response = await handleMutateRequest(
    zqlDb,
    async (transact, mutation) => {
      return transact(async (tx, mutatorName, mutatorArgs) => {
        const mutator = mustGetMutator(mutators, mutatorName);
        await mutator.fn({ tx, args: mutatorArgs, ctx: { userID } });
      });
    },
    toWebRequest(event),
  );

  return response;
});
