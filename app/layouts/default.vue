<template>
  <UDashboardGroup unit="rem">
    <!-- Sidebar for desktop (hidden on mobile) -->
    <UDashboardSidebar collapsible resizable>
      <template #header="{ collapsed }">
        <div
          class="flex items-center justify-between py-3 flex-1"
          :class="collapsed ? 'pl-1' : 'pl-4'"
        >
          <NuxtLink v-if="!collapsed" to="/" class="flex items-center gap-2">
            <AppLogo class="w-auto h-6 shrink-0" />
          </NuxtLink>
          <UDashboardSidebarCollapse />
        </div>
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

    <!-- Bottom navigation for mobile (hidden on desktop) -->
    <nav
      class="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-elevated border-t border-default"
    >
      <UNavigationMenu
        :items="mobileNavigationLinks"
        orientation="horizontal"
        content-orientation="vertical"
        class="justify-around px-2"
        :ui="{
          linkLabel: 'text-xs',
          link: 'flex-col gap-1 px-3',
        }"
      />
    </nav>

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
    {
      label: "Categories",
      icon: "i-lucide-tags",
      to: "/categories",
    },
    {
      label: "Budgets",
      icon: "i-lucide-pie-chart",
      to: "/budgets",
    },
  ],
];

// Mobile navigation links (flattened, without grouping)
const mobileNavigationLinks = [
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
  {
    label: "Categories",
    icon: "i-lucide-tags",
    to: "/categories",
  },
  {
    label: "Budgets",
    icon: "i-lucide-pie-chart",
    to: "/budgets",
  },
];
</script>
