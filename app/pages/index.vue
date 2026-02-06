<script setup lang="ts">
import type { User } from "#db/schema";

definePageMeta({ layout: "default" });

// Fetch session directly from API endpoint
const { data: session } = await useFetch<{
  user?: User;
  session?: {
    id: string;
    expiresAt: Date;
  };
}>("/api/auth/get-session", {
  credentials: "include",
});
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar title="Dashboard" />
    <UPageCard>
      <div class="space-y-6">
        <div>
          <h1 class="text-3xl font-bold">Welcome to Nuxt Money</h1>
          <p class="text-muted mt-2">
            Hello, {{ session?.user?.name || session?.user?.email }}!
          </p>
        </div>

        <div class="space-y-4">
          <p class="text-muted">
            Use the sidebar to navigate to your accounts or manage settings.
          </p>
        </div>
      </div>
    </UPageCard>
  </UDashboardPanel>
</template>
