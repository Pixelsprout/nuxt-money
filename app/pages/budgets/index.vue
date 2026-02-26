<script setup lang="ts">
import { useQuery } from "zero-vue";
import type { Budget } from "#db/schema";
import { queries } from "~/db/zero-queries";

definePageMeta({ layout: "default" });

const z = useZero();
const { data: budgets } = useQuery(
  z,
  () => queries.budgets.list({ userID: z.userID }),
);

const formatDate = (date: Date | string | number) => {
  return new Date(date).toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
};

const getPeriodLabel = (period: string) => {
  switch (period) {
    case "QUARTERLY":
      return "Quarterly";
    case "YEARLY":
      return "Yearly";
    default:
      return "Monthly";
  }
};

const getStatusColor = (status: string | null) => {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "ARCHIVED":
      return "neutral";
    case "DRAFT":
      return "warning";
    default:
      return "warning";
  }
};

const getStatusLabel = (status: string | null) => {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Active";
    case "ARCHIVED":
      return "Archived";
    default:
      return status || "Unknown";
  }
};

const isDraft = (budget: Budget) => budget.status === "DRAFT";

const handleEditClick = (event: Event, budgetId: string) => {
  event.stopPropagation();
  navigateTo(`/budgets/${budgetId}/edit`);
};
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Budgets">
        <template #right>
          <UButton icon="i-lucide-plus" to="/budgets/create">
            Create Budget
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <div>
          <p class="text-muted">
            Manage your budgets and track spending against your allocations.
          </p>
        </div>

        <!-- Empty State -->
        <div
          v-if="budgets.length === 0"
          class="text-center py-12 space-y-4"
        >
          <div class="text-muted">
            <p class="text-lg">No budgets yet</p>
            <p class="text-sm mt-2">
              Create your first budget to start tracking your income and
              expenses.
            </p>
          </div>
          <UButton icon="i-lucide-plus" to="/budgets/create">
            Create Budget
          </UButton>
        </div>

        <!-- Budget Grid -->
        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div
            v-for="budget in budgets"
            :key="budget.id"
            class="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            @click="navigateTo(`/budgets/${budget.id}`)"
          >
            <div class="flex justify-between items-start mb-3">
              <div>
                <h3 class="font-semibold">{{ budget.name }}</h3>
                <p class="text-sm text-muted">
                  {{ getPeriodLabel(budget.period) }}
                </p>
              </div>
              <UBadge :color="getStatusColor(budget.status)" variant="subtle">
                {{ getStatusLabel(budget.status) }}
              </UBadge>
            </div>

            <div class="text-sm text-muted space-y-1">
              <div class="flex justify-between">
                <span>Start:</span>
                <span>{{ formatDate(budget.periodStart) }}</span>
              </div>
              <div class="flex justify-between">
                <span>End:</span>
                <span>{{ formatDate(budget.periodEnd) }}</span>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t">
              <div v-if="isDraft(budget)" class="flex gap-2">
                <UButton
                  size="sm"
                  variant="solid"
                  color="primary"
                  icon="i-lucide-pencil"
                  class="flex-1 justify-center"
                  @click="handleEditClick($event, budget.id)"
                >
                  Edit Draft
                </UButton>
                <UButton
                  size="sm"
                  variant="ghost"
                  icon="i-lucide-eye"
                  @click.stop="navigateTo(`/budgets/${budget.id}`)"
                >
                  View
                </UButton>
              </div>
              <UButton
                v-else
                size="sm"
                variant="ghost"
                icon="i-lucide-arrow-right"
                trailing
                class="w-full justify-center"
              >
                View Details
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
