import { defineQueries, defineQuery } from "@rocicorp/zero";
import { zql } from "./zero-schema.gen";

export const queries = defineQueries({
  accounts: {
    list: defineQuery(({ ctx }: { ctx: { userID: string } }) =>
      zql.akahuAccount.where("userId", ctx.userID),
    ),
  },
});
