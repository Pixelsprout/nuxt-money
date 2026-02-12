<script setup lang="ts">
const emit = defineEmits<{
  "save-draft": [];
  discard: [];
}>();

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
  <ResponsiveModal v-model:open="open" title="Unsaved Changes">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted-foreground">
          You have unsaved changes. Would you like to save this budget as a
          draft?
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="handleDiscard">
          Discard Changes
        </UButton>
        <UButton @click="handleSaveDraft"> Save Draft </UButton>
      </div>
    </template>
  </ResponsiveModal>
</template>
