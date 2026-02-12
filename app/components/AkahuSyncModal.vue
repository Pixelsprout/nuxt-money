<script setup lang="ts">
const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  synced: [];
}>();

const availableAccounts = ref<any[]>([]);
const selectedAccountIds = ref<string[]>([]);
const loading = ref(false);
const error = ref("");

const resetModal = () => {
  availableAccounts.value = [];
  selectedAccountIds.value = [];
  error.value = "";
};

watch(open, async (value) => {
  if (value) {
    // Fetch accounts when modal opens
    await fetchAccounts();
  } else {
    resetModal();
  }
});

const fetchAccounts = async () => {
  loading.value = true;
  error.value = "";

  try {
    const response = await $fetch("/api/accounts/akahu/available");

    if (response.success && response.accounts) {
      availableAccounts.value = response.accounts;
    }
  } catch (err: any) {
    console.error("Failed to fetch accounts:", err);
    error.value = err.data?.message || "Failed to fetch accounts from Akahu.";
  } finally {
    loading.value = false;
  }
};

const syncAccounts = async () => {
  if (selectedAccountIds.value.length === 0) {
    error.value = "Please select at least one account";
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const response = await $fetch("/api/accounts/akahu/sync", {
      method: "POST",
      body: {
        accountIds: selectedAccountIds.value,
      },
    });

    if (response.success) {
      open.value = false;
      emit("synced");
    }
  } catch (err: any) {
    console.error("Failed to sync accounts:", err);
    error.value = err.data?.message || "Failed to sync accounts.";
  } finally {
    loading.value = false;
  }
};

const toggleAccount = (accountId: string) => {
  const index = selectedAccountIds.value.indexOf(accountId);
  if (index > -1) {
    selectedAccountIds.value.splice(index, 1);
  } else {
    selectedAccountIds.value.push(accountId);
  }
};

const formatCurrency = (balance: any) => {
  if (!balance || typeof balance !== "object") return "$0.00";
  const amount = balance.current || 0;
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(amount);
};
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    title="Select Accounts to Sync"
    description="Choose the Akahu accounts you want to sync"
  >
    <template #body>
      <div class="space-y-4">
        <div v-if="error" class="text-sm text-error">
          {{ error }}
        </div>

        <!-- Loading State -->
        <div
          v-if="loading && availableAccounts.length === 0"
          class="text-center py-8 text-muted"
        >
          Loading accounts...
        </div>

        <!-- Account Selection -->
        <div v-else class="space-y-3 max-h-96 overflow-y-auto">
          <div
            v-for="account in availableAccounts"
            :key="account._id"
            class="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
            @click="toggleAccount(account._id)"
          >
            <div class="flex items-start gap-3">
              <UCheckbox
                :model-value="selectedAccountIds.includes(account._id)"
                @update:model-value="toggleAccount(account._id)"
              />
              <div class="flex-1">
                <div class="font-medium">{{ account.name }}</div>
                <div class="text-sm text-muted">
                  {{ account.formatted_account }}
                </div>
                <div class="text-sm font-semibold mt-1">
                  {{ formatCurrency(account.balance) }}
                </div>
              </div>
              <UBadge size="sm" color="neutral">
                {{ account.type }}
              </UBadge>
            </div>
          </div>

          <div
            v-if="!loading && availableAccounts.length === 0"
            class="text-center py-8 text-muted"
          >
            No accounts found
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="open = false">
          Cancel
        </UButton>
        <UButton
          :loading="loading"
          :disabled="selectedAccountIds.length === 0"
          @click="syncAccounts"
        >
          Sync Selected ({{ selectedAccountIds.length }})
        </UButton>
      </div>
    </template>
  </ResponsiveModal>
</template>
