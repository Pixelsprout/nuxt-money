<script setup lang="ts">
import { authClient } from "~/lib/auth-client";
import type { User } from "#db/schema";
import type { DropdownMenuItem } from "@nuxt/ui";

const { data: session } = await useFetch<{
  user?: User;
}>("/api/auth/get-session", {
  credentials: "include",
});

const colorMode = useColorMode();

const handleSignOut = async () => {
  await authClient.signOut();
  reloadNuxtApp({
    path: "/login",
  });
};

const userDisplayName = computed(() => {
  return session.value?.user?.name || session.value?.user?.email || "User";
});

const items = computed(
  () =>
    [
      [
        {
          label: userDisplayName.value,
          type: "label" as const,
        },
        {
          label: session.value?.user?.email || "",
          type: "label" as const,
        },
      ],
      [
        {
          label: "Appearance",
          icon: "i-lucide-sun-moon",
          children: [
            {
              label: "Light",
              icon: "i-lucide-sun",
              type: "checkbox" as const,
              checked: colorMode.value === "light",
              onSelect(e: Event) {
                e.preventDefault();
                colorMode.preference = "light";
              },
            },
            {
              label: "Dark",
              icon: "i-lucide-moon",
              type: "checkbox" as const,
              checked: colorMode.value === "dark",
              onSelect(e: Event) {
                e.preventDefault();
                colorMode.preference = "dark";
              },
            },
          ],
        },
      ],
      [
        {
          label: "Sign Out",
          icon: "i-lucide-log-out",
          onSelect: handleSignOut,
        },
      ],
    ] satisfies DropdownMenuItem[][],
);
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton color="neutral" variant="ghost" class="w-full justify-start">
      <UAvatar :alt="userDisplayName" size="xs" />
      <span class="truncate">{{ userDisplayName }}</span>
    </UButton>
  </UDropdownMenu>
</template>
