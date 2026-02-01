<script setup lang="ts">
import { authClient } from "~/lib/auth-client";

// Fetch session directly from API endpoint
const { data: session } = await useFetch("/api/auth/get-session", {
  credentials: "include",
});

const handleSignOut = async () => {
  await authClient.signOut();
  // Use reloadNuxtApp to force a full page reload with fresh session state
  await reloadNuxtApp({
    path: "/login",
  });
};
</script>

<template>
  <UPageCard>
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-bold">Welcome to Nuxt Money</h1>
        <p class="text-muted mt-2">
          Hello, {{ session?.user?.name || session?.user?.email }}!
        </p>
      </div>

      <div>
        <UButton color="error" variant="soft" @click="handleSignOut">
          Sign Out
        </UButton>
      </div>
    </div>
  </UPageCard>
</template>
