import { useDrizzle } from "#utils/drizzle";
import { invite } from "#db/schema";
import { nanoid } from "nanoid";
import { auth } from "#root/lib/auth";

export default defineEventHandler(async (event) => {
  // Convert h3 event to Web Request
  const request = toWebRequest(event);

  // Call auth handler to get session (same way as auth endpoints do)
  const sessionResponse = await auth.handler(request);

  // Check if this is a valid session response
  let session = null;
  try {
    const sessionData = await sessionResponse.json();
    if (sessionData && sessionData.user) {
      session = sessionData;
    }
  } catch (e) {
    // Not a valid session
  }

  console.log(
    "[invites] Session check result:",
    session ? "authenticated" : "not authenticated",
  );

  if (session) {
    console.log("[invites] Session user:", session.user?.email);
  }

  if (!session) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized - You must be logged in to create invites",
    });
  }

  // TODO: Add role-based access control to restrict to admin users only
  // For now, any authenticated user can create invites
  // You can add: if (session.user.role !== 'admin') { throw 403 error }

  const body = await readBody(event);
  const { email } = body;

  if (!email || typeof email !== "string") {
    throw createError({
      statusCode: 400,
      message: "Email is required",
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      message: "Invalid email format",
    });
  }

  const db = useDrizzle();

  try {
    const newInvite = await db
      .insert(invite)
      .values({
        id: nanoid(),
        email: email.toLowerCase(),
        invitedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      invite: newInvite[0],
    };
  } catch (error: any) {
    // Handle unique constraint violation
    if (
      error.code === "SQLITE_CONSTRAINT" ||
      error.message?.includes("UNIQUE")
    ) {
      throw createError({
        statusCode: 409,
        message: "An invite already exists for this email",
      });
    }
    throw createError({
      statusCode: 500,
      message: "Failed to create invite",
    });
  }
});
