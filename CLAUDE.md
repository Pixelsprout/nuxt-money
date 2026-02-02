# Claude Code Instructions for Nuxt Money

## TypeScript Best Practices

### Always Use Drizzle Schema Types

When working with database models or API responses that return database records, **always import and use types from the Drizzle schema** instead of manually defining inline types.

**Correct:**
```typescript
import type { User, AkahuAccount } from "#db/schema";

const { data } = await useFetch<{ user?: User }>("/api/auth/get-session");
```

**Incorrect:**
```typescript
// Don't do this - manually defining types that already exist in the schema
const { data } = await useFetch<{
  user?: {
    id: string;
    name?: string;
    email: string;
  };
}>("/api/auth/get-session");
```

### Available Schema Types

The following types are exported from `#db/schema`:
- `User` - From `db/auth/auth.ts`
- `Invite` - From `db/auth/auth.ts`
- `AkahuAccount` - From `db/schema.ts`

### Why Use Schema Types?

1. **Single source of truth** - Type definitions match the database schema exactly
2. **Automatic updates** - When the schema changes, TypeScript types update automatically
3. **More complete** - Includes all fields, not just the ones you remember
4. **Type safety** - Catches mismatches between API responses and database models

## Authentication Patterns

### Server-Side API Routes

Always validate sessions at the start of protected API routes:

```typescript
import { auth } from "#root/lib/auth";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.node.req.headers as Record<string, string>,
  });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  // Your route logic here
});
```

### Client-Side Session Checks

Use the session endpoint with proper typing:

```typescript
import type { User } from "#db/schema";

const { data: session } = await useFetch<{
  user?: User;
}>("/api/auth/get-session", {
  credentials: "include",
});
```

## Akahu Integration

### Using the Akahu Client

The Akahu SDK client is initialized with the app token only. User tokens are passed as parameters to API methods:

```typescript
import { getAkahuClient, getAkahuUserToken } from "#root/server/utils/akahu";

const akahuClient = getAkahuClient();
const userToken = getAkahuUserToken();
const accounts = await akahuClient.accounts.list(userToken);
```

### Environment Variables

Akahu tokens must be added to `nuxt.config.ts` runtimeConfig:

```typescript
runtimeConfig: {
  AKAHU_APP_TOKEN: process.env.AKAHU_APP_TOKEN,
  AKAHU_USER_TOKEN: process.env.AKAHU_USER_TOKEN,
  // ...
}
```

## Database Patterns

### Using Drizzle ORM

Always use the `useDrizzle()` helper in server routes:

```typescript
import { useDrizzle } from "#utils/drizzle";
import { akahuAccount } from "#db/schema";
import { eq } from "drizzle-orm";

const db = useDrizzle();
const accounts = await db
  .select()
  .from(akahuAccount)
  .where(eq(akahuAccount.userId, session.user.id));
```

### Generating Migrations

After modifying schema files:

```bash
npm run db:generate  # Creates migration file
# Migration is applied automatically on next dev server start
```

## Component Patterns

### Using Nuxt UI Components

Check the Nuxt UI documentation for component APIs using the MCP tool:

```typescript
// Use the ToolSearch to find and load Nuxt UI component docs
// Then use mcp__nuxt-ui-remote__get-component to get usage details
```

Common components:
- `UButton` - Buttons with variants, colors, and loading states
- `UModal` - Modal dialogs with header, body, and footer slots
- `UBadge` - Status badges
- `UInput` - Form inputs
- `UCheckbox` - Checkboxes

### Component Best Practices

1. Use `v-model:open` for modal visibility
2. Emit events for parent component actions (e.g., `@deleted`, `@synced`)
3. Use computed properties for derived state
4. Add proper TypeScript types for props and emits

## File Structure

- `app/pages/` - Nuxt pages (automatic routing)
- `app/components/` - Vue components (auto-imported)
- `app/middleware/` - Route middleware
- `server/api/` - API routes
- `server/utils/` - Server-side utilities
- `db/` - Database schema and migrations
- `lib/` - Shared libraries (auth, etc.)
