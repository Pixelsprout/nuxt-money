<script setup lang="ts">
const props = defineProps<{
  accountId: string;
}>();

const emit = defineEmits<{
  synced: [count: number];
}>();

const toast = useToast();
const syncing = ref(false);

// Calculate default date range (3 months back from today)
const getDefaultStartDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  return date.toISOString().split("T")[0];
};

const getDefaultEndDate = () => {
  return new Date().toISOString().split("T")[0];
};

const startDate = ref(getDefaultStartDate());
const endDate = ref(getDefaultEndDate());

const handleSync = async () => {
  if (!startDate.value || !endDate.value) {
    toast.add({
      title: "Please select both start and end dates",
      color: "error",
      icon: "i-lucide-alert-circle",
    });
    return;
  }

  syncing.value = true;

  try {
    // Convert dates to ISO 8601 format with UTC timezone
    // Start at beginning of day (00:00:00.000Z)
    // End at end of day (23:59:59.999Z)
    const startISO = new Date(startDate.value + "T00:00:00.000Z").toISOString();
    const endISO = new Date(endDate.value + "T23:59:59.999Z").toISOString();

    console.log("Syncing transactions:", { startISO, endISO });

    const response = await $fetch<{
      success: boolean;
      syncedCount: number;
    }>("/api/transactions/akahu/sync", {
      method: "POST",
      body: {
        accountId: props.accountId,
        startDate: startISO,
        endDate: endISO,
      },
    });

    if (response.success) {
      toast.add({
        title: `Successfully synced ${response.syncedCount} transactions`,
        color: "success",
        icon: "i-lucide-check-circle",
      });

      emit("synced", response.syncedCount);
    }
  } catch (error: any) {
    console.error("Failed to sync transactions:", error);
    toast.add({
      title: "Failed to sync transactions",
      description: error.message || "Please try again",
      color: "error",
      icon: "i-lucide-alert-circle",
    });
  } finally {
    syncing.value = false;
  }
};
</script>

<template>
  <div class="border rounded-lg p-4">
    <div class="space-y-4">
      <div>
        <h3 class="font-semibold text-lg mb-3">Sync Transactions</h3>
        <p class="text-sm text-muted">
          Select a date range to sync transactions from your Akahu account
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UInput
          v-model="startDate"
          type="date"
          label="Start Date"
          :disabled="syncing"
        />

        <UInput
          v-model="endDate"
          type="date"
          label="End Date"
          :disabled="syncing"
        />

        <div class="flex items-end">
          <UButton
            icon="i-lucide-refresh-cw"
            :loading="syncing"
            @click="handleSync"
            class="w-full"
          >
            Sync Transactions
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
