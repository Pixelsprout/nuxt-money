<script setup lang="ts">
import type { AkahuAccount } from "#db/schema";

const route = useRoute();
const router = useRouter();
const accountId = route.params.id as string;

// Fetch account details
const {
  data: accountsData,
  pending,
  error,
} = await useFetch<{
  success: boolean;
  accounts: AkahuAccount[];
}>("/api/accounts/synced", {
  credentials: "include",
});

// Find the specific account
const account = computed(() => {
  return accountsData.value?.accounts.find((a) => a.id === accountId);
});

// Watch for when data is loaded and check if account exists
watch(
  () => accountsData.value,
  (data) => {
    if (data && !account.value) {
      throw createError({
        statusCode: 404,
        message: "Account not found",
      });
    }
  },
  { immediate: true },
);

// Refresh key for transaction table
const transactionTable = ref();

const handleSynced = async (count: number) => {
  // Refresh the transaction table after sync
  if (transactionTable.value?.refresh) {
    await transactionTable.value.refresh();
  }
};
</script>

<template>
  <UPageCard>
    <!-- Loading State -->
    <div v-if="pending" class="text-center py-12">
      <p class="text-muted">Loading account...</p>
    </div>

    <!-- Content -->
    <div v-else-if="account" class="space-y-6">
      <!-- Back button -->
      <div>
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          @click="router.push('/accounts')"
        >
          Back to Accounts
        </UButton>
      </div>

      <!-- Account Header -->
      <AccountHeader :account="account" />

      <!-- Sync Form -->
      <TransactionSyncForm :account-id="accountId" @synced="handleSynced" />

      <!-- Transaction Table -->
      <TransactionTable ref="transactionTable" :account-id="accountId" />
    </div>

    <!-- Error/Not Found State -->
    <div v-else class="text-center py-12">
      <p class="text-muted">Account not found</p>
      <UButton
        class="mt-4"
        icon="i-lucide-arrow-left"
        variant="outline"
        color="neutral"
        @click="router.push('/accounts')"
      >
        Back to Accounts
      </UButton>
    </div>
  </UPageCard>
</template>
