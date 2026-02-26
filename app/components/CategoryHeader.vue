<script setup lang="ts">
import type { TransactionCategory } from "#db/schema";

const props = defineProps<{
  category: TransactionCategory;
  transactionCount: number;
}>();

const emit = defineEmits<{
  deleted: [];
  edit: [];
}>();

const deleting = ref(false);
const z = useZero();

const lastUpdated = computed(() => {
  if (props.category.updatedAt) {
    return new Date(props.category.updatedAt).toLocaleDateString("en-NZ");
  }
  return "Unknown";
});

const handleDelete = async () => {
  if (!confirm(`Are you sure you want to delete the category "${props.category.name}"?`)) {
    return;
  }

  deleting.value = true;
  try {
    await z.mutate.categories.delete({ id: props.category.id });
    emit("deleted");
    await navigateTo("/categories");
  } catch (error) {
    console.error("Failed to delete category:", error);
    alert("Failed to delete category. Please try again.");
  } finally {
    deleting.value = false;
  }
};
</script>

<template>
  <div class="border rounded-lg p-6 space-y-4">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div
          class="w-12 h-12 rounded"
          :style="{ backgroundColor: category.color }"
        />
        <div class="flex-1">
          <h1 class="text-3xl font-bold">{{ category.name }}</h1>
          <p v-if="category.description" class="text-muted mt-1">
            {{ category.description }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          color="gray"
          variant="ghost"
          size="xs"
          icon="i-lucide-pencil"
          @click="emit('edit')"
        />
        <UButton
          color="red"
          variant="ghost"
          size="xs"
          icon="i-lucide-trash-2"
          :loading="deleting"
          @click="handleDelete"
        />
      </div>
    </div>

    <div class="flex justify-between items-end">
      <div>
        <p class="text-sm text-muted">Transactions</p>
        <p class="text-4xl font-bold mt-1">
          {{ transactionCount }}
        </p>
      </div>

      <div class="text-right">
        <p class="text-sm text-muted">Last Updated</p>
        <p class="text-sm font-medium mt-1">
          {{ lastUpdated }}
        </p>
      </div>
    </div>
  </div>
</template>
