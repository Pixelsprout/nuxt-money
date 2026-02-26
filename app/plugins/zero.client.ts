import { Zero } from "@rocicorp/zero";
import { schema } from "~/db/zero-schema.gen";
import { mutators } from "~/db/zero-mutators";

// Attach mutator namespaces to the mutate function so the shorthand
// z.mutate.categories.update({...}) works with the defineMutators API.
// Each leaf Mutator callable creates a MutateRequest; we wrap it to also
// execute it via z.mutate(mr) in one step.
function attachMutators(
  registry: Record<string, unknown>,
  target: Record<string, unknown>,
  execute: (mr: unknown) => unknown,
) {
  for (const [key, value] of Object.entries(registry)) {
    if (key === "~") continue;
    if (typeof value === "function") {
      target[key] = (...args: unknown[]) =>
        execute((value as (...a: unknown[]) => unknown)(...args));
    } else if (value && typeof value === "object") {
      target[key] = {};
      attachMutators(
        value as Record<string, unknown>,
        target[key] as Record<string, unknown>,
        execute,
      );
    }
  }
}

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
    mutators,
    kvStore: "idb",
    context: { userID },
  });

  // Bridge the new defineMutators API to the z.mutate.X.Y({...}) shorthand
  attachMutators(
    mutators as unknown as Record<string, unknown>,
    z.mutate as unknown as Record<string, unknown>,
    (mr) => (z.mutate as unknown as (mr: unknown) => unknown)(mr),
  );

  return {
    provide: { zero: z },
  };
});
