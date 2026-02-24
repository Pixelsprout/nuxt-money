import { drizzleZeroConfig } from "drizzle-zero";
import * as drizzleSchema from "../db/schema";

export default drizzleZeroConfig(drizzleSchema, {
  tables: {
    akahuAccount: {
      id: true,
      userId: true,
      akahuId: true,
      name: true,
      type: true,
      formattedAccount: true,
      balance: true,
      syncedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
});
