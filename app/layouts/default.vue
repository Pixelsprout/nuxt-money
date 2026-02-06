<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar collapsible resizable>
      <template #header>
        <NuxtLink to="/" class="flex items-center gap-2 px-4 py-3">
          <AppLogo class="w-auto h-6 shrink-0" />
        </NuxtLink>
      </template>

      <UNavigationMenu
        :items="navigationLinks"
        orientation="vertical"
        default-open
      />

      <template #footer>
        <UserMenu />
      </template>
    </UDashboardSidebar>

    <slot />

    <UDashboardSearch />
  </UDashboardGroup>
</template>

<script setup lang="ts">
const navigationLinks = [
  [
    {
      label: "Home",
      icon: "i-lucide-home",
      to: "/",
    },
    {
      label: "Accounts",
      icon: "i-lucide-wallet",
      to: "/accounts",
    },
  ],
];
</script>
