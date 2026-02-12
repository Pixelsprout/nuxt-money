<script setup lang="ts">
/**
 * ResponsiveModal - A component that renders UModal on desktop and UDrawer on mobile
 * Uses SSR-safe media query to prevent hydration mismatches
 */

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    preventClose?: boolean;
  }>(),
  {
    preventClose: false,
  }
);

const open = defineModel<boolean>("open", { default: false });
const isDesktop = useSSRMediaQuery("(min-width: 768px)");
</script>

<template>
  <!-- Desktop: Modal -->
  <UModal
    v-if="isDesktop"
    v-model:open="open"
    :title="title"
    :description="description"
    :prevent-close="preventClose"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <template #body>
      <slot name="body" />
    </template>

    <template v-if="$slots.footer" #footer="footerProps">
      <slot name="footer" v-bind="footerProps" />
    </template>
  </UModal>

  <!-- Mobile: Drawer -->
  <UDrawer
    v-else
    v-model:open="open"
    :title="title"
    :description="description"
    :prevent-close="preventClose"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <template #body>
      <slot name="body" />
    </template>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UDrawer>
</template>
