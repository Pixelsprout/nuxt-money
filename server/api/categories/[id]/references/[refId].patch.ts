import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { transactionReference } from "#db/schema";
import { eq, and } from "drizzle-orm";
import type { AmountCondition } from "#db/schema";

const VALID_OPERATORS = ["gte", "lte", "eq", "gt", "lt"];

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const refId = getRouterParam(event, "refId");

  if (!refId) {
    throw createError({
      statusCode: 400,
      message: "Reference ID is required",
    });
  }

  const body = await readBody(event);
  const { amountCondition } = body as {
    amountCondition?: AmountCondition | null;
  };

  // Validate amountCondition if provided
  if (amountCondition !== null && amountCondition !== undefined) {
    if (
      !VALID_OPERATORS.includes(amountCondition.operator) ||
      typeof amountCondition.value !== "number" ||
      amountCondition.value < 0
    ) {
      throw createError({
        statusCode: 400,
        message:
          "Invalid amount condition. Requires operator (gte, lte, eq, gt, lt) and a non-negative numeric value.",
      });
    }
  }

  const db = useDrizzle();

  try {
    // Verify reference ownership
    const references = await db
      .select()
      .from(transactionReference)
      .where(
        and(
          eq(transactionReference.id, refId),
          eq(transactionReference.userId, session.user.id),
        ),
      )
      .limit(1);

    if (references.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Reference not found",
      });
    }

    // Update the reference
    const updated = await db
      .update(transactionReference)
      .set({
        amountCondition: amountCondition ?? null,
        updatedAt: new Date(),
      })
      .where(eq(transactionReference.id, refId))
      .returning();

    return {
      success: true,
      reference: updated[0],
    };
  } catch (error: any) {
    if (error.statusCode) throw error;

    console.error("[categories/references] Error updating:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update reference",
    });
  }
});
