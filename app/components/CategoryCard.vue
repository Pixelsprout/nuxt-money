<script setup lang="ts">
import type { TransactionCategory } from "#db/schema";

const props = defineProps<{
  category: TransactionCategory;
  transactionCount?: number;
}>();

const emit = defineEmits<{
  deleted: [];
  updated: [];
}>();

const deleting = ref(false);

const count = computed(() => props.transactionCount ?? 0);

const handleDelete = async () => {
  if (!confirm("Are you sure you want to delete this category?")) {
    return;
  }

  deleting.value = true;
  try {
    await $fetch(`/api/categories/${props.category.id}`, {
      method: "DELETE",
    });
    emit("deleted");
  } catch (error) {
    console.error("Failed to delete category:", error);
    alert("Failed to delete category. Please try again.");
  } finally {
    deleting.value = false;
  }
};
</script>

<template>
  <div
    class="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-gray-50 transition-colors"
    @click="navigateTo(`/categories/${category.id}`)"
  >
    <div class="flex justify-between items-start gap-2">
      <div class="flex items-start gap-3 flex-1 min-w-0">
        <div
          class="w-4 h-4 rounded-full flex-shrink-0 mt-1"
          :style="{ backgroundColor: category.color }"
        />
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold">{{ category.name }}</h3>
          <p v-if="category.description" class="text-sm text-muted line-clamp-2">
            {{ category.description }}
          </p>
        </div>
      </div>
      <UButton
        color="error"
        variant="ghost"
        size="sm"
        icon="i-lucide-trash-2"
        :loading="deleting"
        @click.stop="handleDelete"
      />
    </div>

    <div class="flex justify-between items-center pt-1">
      <div>
        <p class="text-xs text-muted">Transactions</p>
        <p class="text-lg font-semibold">{{ count }}</p>
      </div>
    </div>
  </div>
</template>
