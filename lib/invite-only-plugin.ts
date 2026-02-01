import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import * as schema from "#db/schema";
import { useDrizzle } from "#utils/drizzle";
import { eq } from "drizzle-orm";

export const inviteOnlyPlugin = (): BetterAuthPlugin => {
  return {
    id: "invite-only",
    init() {
      console.log("[invite-only] Plugin initialized");

      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                async before(user) {
                  const email = user.email;

                  console.log(
                    "[invite-only] Database hook - checking invite for:",
                    email,
                  );

                  if (!email) {
                    throw new APIError("BAD_REQUEST", {
                      message: "Email is required for user creation",
                    });
                  }

                  const db = useDrizzle();

                  // Check if there's a valid invite for this email
                  const invite = await db
                    .select()
                    .from(schema.invite)
                    .where(eq(schema.invite.email, email))
                    .limit(1);

                  if (invite.length === 0) {
                    console.log(
                      "[invite-only] No invite found for",
                      email,
                      "- blocking user creation",
                    );

                    // Throw a custom error that we can catch in onResponse
                    const error: any = new Error(
                      "INVITE_REQUIRED: This application is invite-only. Please request an invite to continue.",
                    );
                    error.statusCode = 403;
                    error.isInviteError = true;
                    throw error;
                  }

                  console.log(
                    "[invite-only] Invite found for",
                    email,
                    "- allowing user creation",
                  );

                  // Return the user data to proceed with creation
                  return { data: user };
                },
                async after(user) {
                  const email = user.email;

                  console.log(
                    "[invite-only] User created successfully, marking invite as accepted for:",
                    email,
                  );

                  const db = useDrizzle();

                  // Update the invite to mark it as accepted
                  await db
                    .update(schema.invite)
                    .set({
                      acceptedAt: new Date(),
                      updatedAt: new Date(),
                    })
                    .where(eq(schema.invite.email, email));

                  console.log(
                    "[invite-only] Invite marked as accepted for",
                    email,
                  );
                },
              },
            },
          },
        },
      };
    },
    onResponse: async (response, ctx) => {
      // Check if this is an error response
      if (response.status === 500 || response.status === 403) {
        try {
          const body = await response.text();

          // Check if this is our invite error
          if (
            body.includes("INVITE_REQUIRED") ||
            body.includes("invite-only")
          ) {
            console.log("[invite-only] Intercepting error, redirecting...");

            const errorURL = `${ctx.baseURL}/error`;
            const message = encodeURIComponent(
              "This application is invite-only. Please request an invite to continue.",
            );

            // Return a redirect response
            return {
              response: new Response(null, {
                status: 302,
                headers: {
                  Location: `${errorURL}?error=invite_only&error_description=${message}`,
                },
              }),
            };
          }
        } catch (e) {
          // If we can't parse the response, let it through
          console.log("[invite-only] Could not parse response:", e);
        }
      }
    },
  };
};
