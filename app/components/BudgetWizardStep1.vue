<script setup lang="ts">
import { CalendarDate } from "@internationalized/date";

const name = defineModel<string>("name", { required: true });
const period = defineModel<"MONTHLY" | "QUARTERLY" | "YEARLY">("period", {
  required: true,
});
const periodStart = defineModel<Date>("periodStart", { required: true });
const periodEnd = defineModel<Date>("periodEnd", { required: true });

const periodOptions = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly (3 months)" },
  { value: "YEARLY", label: "Yearly" },
];

const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Template ref for the InputDate component
const inputDate = useTemplateRef("inputDate");

// Calendar date for the picker
const date = periodStart.value;
const calendarDate = shallowRef(
  new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate()),
);

// Minimum date is today
const today = new Date();
const minDate = new CalendarDate(
  today.getFullYear(),
  today.getMonth() + 1,
  today.getDate(),
);

// When calendarDate changes, update periodStart
watch(calendarDate, (value) => {
  if (value) {
    periodStart.value = new Date(value.year, value.month - 1, value.day);
  }
});
</script>

<template>
  <div class="space-y-6 max-w-lg">
    <div>
      <h2 class="text-xl font-semibold">Budget Basics</h2>
      <p class="text-muted mt-1">
        Give your budget a name and select the period it covers.
      </p>
    </div>

    <div class="space-y-4">
      <UInput
        v-model="name"
        label="Budget Name"
        placeholder="e.g., February 2025 Budget"
        required
      />

      <div>
        <label class="text-sm font-medium block mb-2">Budget Period</label>
        <div class="flex gap-2">
          <UButton
            v-for="option in periodOptions"
            :key="option.value"
            :variant="period === option.value ? 'solid' : 'outline'"
            :color="period === option.value ? 'primary' : 'neutral'"
            @click="period = option.value as typeof period"
          >
            {{ option.label }}
          </UButton>
        </div>
      </div>

      <div>
        <label class="text-sm font-medium block mb-2">Period Start Date</label>
        <UInputDate ref="inputDate" v-model="calendarDate" :min-value="minDate">
          <template #trailing>
            <UPopover :reference="inputDate?.inputsRef?.[3]?.$el">
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-calendar"
                aria-label="Select a date"
                class="px-0"
              />

              <template #content>
                <UCalendar
                  v-model="calendarDate"
                  :min-value="minDate"
                  class="p-2"
                />
              </template>
            </UPopover>
          </template>
        </UInputDate>
        <p class="text-xs text-muted mt-1">
          Select the date when this budget period begins
        </p>
      </div>

      <div class="p-4 rounded-lg bg-muted/50 space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-muted">Period Start:</span>
          <span class="font-medium">{{ formatDate(periodStart) }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-muted">Period End:</span>
          <span class="font-medium">{{ formatDate(periodEnd) }}</span>
        </div>
        <p class="text-xs text-muted">
          End date is automatically calculated based on the period type
        </p>
      </div>
    </div>
  </div>
</template>
