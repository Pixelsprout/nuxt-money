import { Zero } from "@rocicorp/zero";
import { schema } from "~/db/zero-schema.gen";

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();

  // Get user session to determine userID
  let userID = "anon";
  try {
    const session = await $fetch<{ user?: { id: string } }>(
      "/api/auth/get-session",
    );
    if (session?.user?.id) {
      userID = session.user.id;
    }
  } catch {
    // Not authenticated — use anon
  }

  const z = new Zero({
    userID,
    server: config.public.zeroServer as string,
    schema,
    kvStore: "idb",
    context: { userID },
  });

  return {
    provide: { zero: z },
  };
});
