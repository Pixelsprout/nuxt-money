import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import * as schema from "#db/schema";
import { useDrizzle } from "#utils/drizzle";
import { eq } from "drizzle-orm";

export const inviteOnlyPlugin = (): BetterAuthPlugin => {
  return {
    id: "invite-only",
    init() {
      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                async before(user) {
                  const email = user.email;

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
                    // Throw a custom error that we can catch in onResponse
                    const error: any = new Error(
                      "INVITE_REQUIRED: This application is invite-only. Please request an invite to continue.",
                    );
                    error.statusCode = 403;
                    error.isInviteError = true;
                    throw error;
                  }

                  // Return the user data to proceed with creation
                  return { data: user };
                },
                async after(user) {
                  const email = user.email;
                  const db = useDrizzle();

                  // Update the invite to mark it as accepted
                  await db
                    .update(schema.invite)
                    .set({
                      acceptedAt: new Date(),
                      updatedAt: new Date(),
                    })
                    .where(eq(schema.invite.email, email));
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
        }
      }
    },
  };
};
