import { useDrizzle } from "#utils/drizzle";
import { transactionReference } from "#db/schema";
import type { AmountCondition, TransactionReference } from "#db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Check if a transaction amount satisfies an amount condition.
 * Uses absolute value for comparison (debits are negative).
 */
function matchesAmountCondition(
  condition: AmountCondition,
  amount: number,
): boolean {
  const absAmount = Math.abs(amount);
  switch (condition.operator) {
    case "gte":
      return absAmount >= condition.value;
    case "lte":
      return absAmount <= condition.value;
    case "gt":
      return absAmount > condition.value;
    case "lt":
      return absAmount < condition.value;
    case "eq":
      return absAmount === condition.value;
    default:
      return false;
  }
}

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
  amount?: number,
): Promise<TransactionReference | null> {
  const db = useDrizzle();
  const normalizedMerchant = merchant || "";
  const normalizedFromAccount = fromAccount || "";

  /** Check if a reference passes its amount condition (if any). */
  function passesAmountCheck(ref: TransactionReference): boolean {
    if (!ref.amountCondition || amount === undefined) return true;
    return matchesAmountCondition(ref.amountCondition, amount);
  }

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

  if (exact.length > 0 && passesAmountCheck(exact[0])) return exact[0];

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

    if (byMerchant.length > 0 && passesAmountCheck(byMerchant[0]))
      return byMerchant[0];
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

    if (byFromAccount.length > 0 && passesAmountCheck(byFromAccount[0]))
      return byFromAccount[0];
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

  if (byDescription.length > 0 && passesAmountCheck(byDescription[0]))
    return byDescription[0];

  return null;
}

/**
 * Create or update a transaction reference.
 * If an existing reference has an amount condition that the given transaction
 * amount does NOT satisfy, the existing reference is preserved (not overwritten).
 * This prevents a manual category assignment on a different "amount tier"
 * from clobbering an amount-based rule.
 */
export async function upsertTransactionReference(
  userId: string,
  merchant: string | null | undefined,
  description: string,
  fromAccount: string | null | undefined,
  categoryId: string,
  amount?: number,
) {
  const db = useDrizzle();
  const normalizedMerchant = merchant || "";
  const normalizedFromAccount = fromAccount || "";

  // Check for an existing reference with an amount condition
  const existing = await db
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

  if (
    existing.length > 0 &&
    existing[0].amountCondition &&
    amount !== undefined
  ) {
    // If the transaction doesn't satisfy the existing amount rule,
    // preserve the rule — this is a different "tier" of the same pattern
    if (!matchesAmountCondition(existing[0].amountCondition, amount)) {
      return existing[0];
    }
  }

  const result = await db
    .insert(transactionReference)
    .values({
      id: nanoid(),
      userId,
      merchant: normalizedMerchant,
      description,
      fromAccount: normalizedFromAccount,
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
