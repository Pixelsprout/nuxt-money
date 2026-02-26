# ZeroSync Integration - Accounts Sync (Phase 1)

## Context

The application currently fetches all data via Nuxt server API routes using `useFetch`. Each page load hits Postgres through the server. Introducing ZeroSync replicates data to a local SQLite store on the client, enabling instant data loading after initial sync. This first phase syncs only the `akahu_account` table as a proof-of-concept.

SSR will be disabled since ZeroSync operates client-side.

---

## Step 1: Install Dependencies

```bash
pnpm install @rocicorp/zero zero-vue jose
pnpm install -D drizzle-zero
```

- `@rocicorp/zero` - Core Zero library (client + zero-cache CLI)
- `zero-vue` - Vue composables (`useQuery`)
- `jose` - JWT encoding (for Zero auth tokens)
- `drizzle-zero` (dev) - CLI code generator: Drizzle schema → Zero schema

---

## Step 2: Configure PostgreSQL for Logical Replication

**Handled by user** — Postgres runs via DBngin locally. You'll need to enable logical WAL:

```sql
ALTER SYSTEM SET wal_level = 'logical';
```

Then restart Postgres in DBngin. Verify with: `psql -c 'SHOW wal_level'` → should return `logical`.

Same applies to production Postgres.

---

## Step 3: Generate Zero Schema from Drizzle

`drizzle-zero` is a **CLI code generator**. It reads the Drizzle schema and outputs a `zero-schema.gen.ts` file.

### 3a. Create drizzle-zero config

Create **`config/drizzle-zero.config.ts`**:

```typescript
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
```

### 3b. Add generate script to `package.json`

```json
"zero:generate": "drizzle-zero generate --config ./config/drizzle-zero.config.ts --output ./app/db/zero-schema.gen.ts --format"
```

### 3c. Run the generator

```bash
pnpm zero:generate
```

This produces **`app/db/zero-schema.gen.ts`** — a generated file containing the Zero schema with proper type mappings from the Drizzle `akahuAccount` table. This file should be committed but regenerated whenever the Drizzle schema changes.

---

## Step 4: Create Zero Nuxt Plugin

Create **`app/plugins/zero.client.ts`** (`.client` suffix = client-only):

```typescript
import { Zero } from "@rocicorp/zero";
import { schema } from "~/db/zero-schema.gen";

export default defineNuxtPlugin(async () => {
  // Get user session to determine userID
  const session = await $fetch("/api/auth/get-session");
  const userID = session?.user?.id ?? "anon";

  const z = new Zero({
    userID,
    server: useRuntimeConfig().public.zeroServer,
    schema,
    kvStore: "idb",
  });

  return {
    provide: { zero: z },
  };
});
```

---

## Step 5: Create Zero Composable

Create **`app/composables/useZero.ts`**:

```typescript
export const useZero = () => useNuxtApp().$zero;
```

Pages will use this alongside `useQuery` from `zero-vue`:

```typescript
import { useQuery } from "zero-vue";
const z = useZero();
const { data: accounts } = useQuery(() => z.query.akahuAccount);
```

---

## Step 6: Create Server Query Endpoint

Create **`server/api/zero/query.post.ts`**:

This endpoint is called by zero-cache (not the browser). It receives query name + args, validates the user's session via forwarded cookies (Better Auth), and returns ZQL expressions. Since accounts are read-only and user-scoped, the query will filter by `userId`.

Key pattern — reuses existing auth from `lib/auth.ts`:
```typescript
import { auth } from "#root/lib/auth";
const session = await auth.api.getSession({ headers: ... });
```

The query endpoint uses `defineQueries` and `handleQueryRequest` from `@rocicorp/zero` to process incoming requests and return ZQL ASTs.

---

## Step 7: Create Server Mutate Endpoint

Create **`server/api/zero/mutate.post.ts`**:

For this phase, accounts are **read-only** from Zero's perspective — writes happen via the existing Akahu sync API routes which write directly to Postgres. The mutate endpoint is required by zero-cache but will be minimal/empty.

---

## Step 8: Update Nuxt Config

Modify **`nuxt.config.ts`**:

1. Add `ssr: false`
2. Add `public.zeroServer` to runtimeConfig
3. Add Vite optimizations for `@rocicorp/zero`
4. Set `build.target` to `es2022`

```typescript
ssr: false,
runtimeConfig: {
  public: {
    zeroServer: process.env.NUXT_PUBLIC_ZERO_SERVER || "http://localhost:4848",
  },
},
vite: {
  optimizeDeps: { include: ["@rocicorp/zero"] },
  build: { target: "es2022" },
},
```

---

## Step 9: Update Accounts Page

Modify **`app/pages/accounts/index.vue`**:

Replace the `useFetch` call with Zero's reactive query:

```vue
<script setup lang="ts">
import { useQuery } from "zero-vue";

const z = useZero();
const { data: accounts } = useQuery(() => z.query.akahuAccount);
</script>
```

- No need for `refresh()` — Zero automatically pushes changes from Postgres
- The Akahu sync modal / API routes remain unchanged — they write to Postgres, Zero replicates
- The `loading` ref logic simplifies since Zero provides instant local data

---

## Step 10: Add Dev Scripts & Environment

Update **`package.json`** scripts:

```json
"dev:zero-cache": "npx zero-cache",
"zero:generate": "drizzle-zero generate --config ./config/drizzle-zero.config.ts --output ./app/db/zero-schema.gen.ts --format"
```

Create/update **`.env`**:

```
NUXT_PUBLIC_ZERO_SERVER=http://localhost:4848
ZERO_UPSTREAM_DB=$DATABASE_URL
ZERO_QUERY_URL=http://localhost:3000/api/zero/query
ZERO_MUTATE_URL=http://localhost:3000/api/zero/mutate
ZERO_QUERY_FORWARD_COOKIES=true
ZERO_MUTATE_FORWARD_COOKIES=true
```

Dev workflow:
1. Ensure Postgres is running (DBngin) with WAL level set to `logical`
2. `pnpm dev:zero-cache` — Start zero-cache (reads env vars)
3. `pnpm dev` — Start Nuxt

---

## Files Summary

### Create

| File | Purpose |
|------|---------|
| `config/drizzle-zero.config.ts` | drizzle-zero code generator config (accounts only) |
| `app/db/zero-schema.gen.ts` | Generated Zero schema (from `pnpm zero:generate`) |
| `app/plugins/zero.client.ts` | Client-only Nuxt plugin initializing Zero |
| `app/composables/useZero.ts` | Composable to access Zero instance |
| `server/api/zero/query.post.ts` | Query endpoint for zero-cache |
| `server/api/zero/mutate.post.ts` | Mutate endpoint (minimal, accounts are read-only) |

### Modify

| File | Change |
|------|--------|
| `nuxt.config.ts` | `ssr: false`, Zero runtime config, Vite optimizations |
| `package.json` | Dependencies, dev scripts, zero:generate script |
| `app/pages/accounts/index.vue` | Replace `useFetch` with Zero `useQuery` |
| `.env` | Add Zero env vars |

### Unchanged

- All existing server API routes (Akahu sync, budgets, categories, etc.)
- `db/schema.ts` (Drizzle schema)
- Auth system (Better Auth)
- All other pages

---

## Verification

1. Verify WAL in DBngin postgres: `psql -c 'SHOW wal_level'` → `logical`
2. `pnpm db:migrate` — Ensure migrations are applied
3. `pnpm zero:generate` — Generate Zero schema, verify `app/db/zero-schema.gen.ts` exists
4. `pnpm dev:zero-cache` — Confirm zero-cache connects and starts replicating
5. `pnpm dev` — App loads client-side (no SSR)
6. Navigate to `/accounts` — Accounts load from Zero's local replica
7. Click "Sync Accounts" — After Akahu sync, new accounts appear automatically (no page refresh needed)
8. Verify auth — Logged-out users cannot access other users' accounts
