<script setup lang="ts">
import type { AkahuAccount } from "#db/schema";

definePageMeta({ layout: "default" });

const showModal = ref(false);
const loading = ref(false);

const { data: accountsData, refresh } = await useFetch<{
  success: boolean;
  accounts: AkahuAccount[];
}>("/api/accounts/synced");

const accounts = computed<AkahuAccount[]>(() => {
  return accountsData.value?.accounts || [];
});

const refreshAccounts = async () => {
  loading.value = true;
  try {
    await refresh();
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  refreshAccounts();
});
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Accounts">
        <template #right>
          <UButton icon="i-lucide-refresh-cw" @click="showModal = true">
            Sync Accounts
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <div>
          <p class="text-muted">Manage your synced Akahu accounts</p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-12 text-muted">
          Loading accounts...
        </div>

        <!-- Empty State -->
        <div
          v-else-if="accounts.length === 0"
          class="text-center py-12 space-y-4"
        >
          <div class="text-muted">
            <p class="text-lg">No accounts synced yet</p>
            <p class="text-sm mt-2">
              Click "Sync Accounts" to connect your Akahu accounts
            </p>
          </div>
        </div>

        <!-- Accounts Grid -->
        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AkahuAccountCard
            v-for="account in accounts"
            :key="account.id"
            :account="account"
            @deleted="refreshAccounts"
            @synced="refreshAccounts"
          />
        </div>

        <!-- Sync Modal -->
        <AkahuSyncModal v-model:open="showModal" @synced="refreshAccounts" />
      </div>
    </template>
  </UDashboardPanel>
</template>
