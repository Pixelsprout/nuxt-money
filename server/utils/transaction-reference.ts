import { useDrizzle } from "#utils/drizzle";
import { transactionReference } from "#db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Look up a transaction reference matching the given signature.
 * Uses cascading fallback: tries the most specific match first,
 * then progressively less specific until description-only.
 *
 * Priority: merchant + fromAccount + description
 *         → merchant + description
 *         → fromAccount + description
 *         → description only
 */
export async function lookupTransactionReference(
  userId: string,
  merchant: string | null | undefined,
  description: string,
  fromAccount: string | null | undefined,
) {
  const db = useDrizzle();
  const normalizedMerchant = merchant || "";
  const normalizedFromAccount = fromAccount || "";

  // 1. Exact match: merchant + description + fromAccount
  const exact = await db
    .select()
    .from(transactionReference)
    .where(
      and(
        eq(transactionReference.userId, userId),
        eq(transactionReference.merchant, normalizedMerchant),
        eq(transactionReference.description, description),
        eq(transactionReference.fromAccount, normalizedFromAccount),
      ),
    )
    .limit(1);

  if (exact.length > 0) return exact[0];

  // 2. Fallback: merchant + description (ignore fromAccount)
  if (normalizedMerchant) {
    const byMerchant = await db
      .select()
      .from(transactionReference)
      .where(
        and(
          eq(transactionReference.userId, userId),
          eq(transactionReference.merchant, normalizedMerchant),
          eq(transactionReference.description, description),
        ),
      )
      .limit(1);

    if (byMerchant.length > 0) return byMerchant[0];
  }

  // 3. Fallback: fromAccount + description (ignore merchant)
  if (normalizedFromAccount) {
    const byFromAccount = await db
      .select()
      .from(transactionReference)
      .where(
        and(
          eq(transactionReference.userId, userId),
          eq(transactionReference.fromAccount, normalizedFromAccount),
          eq(transactionReference.description, description),
        ),
      )
      .limit(1);

    if (byFromAccount.length > 0) return byFromAccount[0];
  }

  // 4. Final fallback: description only
  const byDescription = await db
    .select()
    .from(transactionReference)
    .where(
      and(
        eq(transactionReference.userId, userId),
        eq(transactionReference.description, description),
      ),
    )
    .limit(1);

  return byDescription.length > 0 ? byDescription[0] : null;
}

/**
 * Create or update a transaction reference.
 * Uses onConflictDoUpdate on the unique index to upsert.
 */
export async function upsertTransactionReference(
  userId: string,
  merchant: string | null | undefined,
  description: string,
  fromAccount: string | null | undefined,
  categoryId: string,
) {
  const db = useDrizzle();

  const result = await db
    .insert(transactionReference)
    .values({
      id: nanoid(),
      userId,
      merchant: merchant || "",
      description,
      fromAccount: fromAccount || "",
      categoryId,
    })
    .onConflictDoUpdate({
      target: [
        transactionReference.userId,
        transactionReference.merchant,
        transactionReference.description,
        transactionReference.fromAccount,
      ],
      set: {
        categoryId,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result[0];
}
