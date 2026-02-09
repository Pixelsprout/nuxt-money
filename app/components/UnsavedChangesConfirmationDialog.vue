<script setup lang="ts">
import { createReusableTemplate, useMediaQuery } from "@vueuse/core";

const [DefineConfirmationTemplate, ReuseConfirmationTemplate] =
  createReusableTemplate();

const emit = defineEmits<{
  "save-draft": [];
  discard: [];
}>();

const isDesktop = useMediaQuery("(min-width: 768px)");
const open = defineModel<boolean>("open", { default: false });

const handleSaveDraft = () => {
  emit("save-draft");
  open.value = false;
};

const handleDiscard = () => {
  emit("discard");
  open.value = false;
};
</script>

<template>
  <!-- Reusable template for modal/drawer content -->
  <DefineConfirmationTemplate>
    <div class="space-y-4">
      <p class="text-sm text-muted-foreground">
        You have unsaved changes. Would you like to save this budget as a draft?
      </p>
    </div>
  </DefineConfirmationTemplate>

  <!-- Desktop: Modal -->
  <UModal
    v-if="isDesktop"
    v-model:open="open"
    title="Unsaved Changes"
  >
    <template #body>
      <ReuseConfirmationTemplate />
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="handleDiscard">
          Discard Changes
        </UButton>
        <UButton @click="handleSaveDraft">
          Save Draft
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Mobile: Drawer -->
  <UDrawer
    v-else
    v-model:open="open"
    title="Unsaved Changes"
  >
    <template #body>
      <ReuseConfirmationTemplate />
    </template>

    <template #footer>
      <UButton
        variant="ghost"
        color="neutral"
        @click="handleDiscard"
        class="w-full justify-center"
      >
        Discard Changes
      </UButton>
      <UButton @click="handleSaveDraft" class="w-full justify-center">
        Save Draft
      </UButton>
    </template>
  </UDrawer>
</template>
