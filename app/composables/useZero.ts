import type { Zero } from "@rocicorp/zero";
import type { Schema } from "~/db/zero-schema.gen";

export const useZero = () => {
  return useNuxtApp().$zero as Zero<Schema>;
};
