import type { Zero } from "@rocicorp/zero";
import type { Schema } from "~/db/zero-schema.gen";
import type { Mutators } from "~/db/zero-mutators";

export type ZeroContext = { userID: string };

type ZeroInstance = Zero<Schema, undefined, ZeroContext> & { mutate: Mutators };

export const useZero = () => {
  return useNuxtApp().$zero as unknown as ZeroInstance;
};
