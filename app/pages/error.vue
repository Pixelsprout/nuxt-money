<script setup lang="ts">
const route = useRoute();

const error = computed(() => route.query.error as string);
const errorDescription = computed(
  () => route.query.error_description as string,
);

const errorMessages: Record<string, { title: string; description: string }> = {
  banned: {
    title: "Account Suspended",
    description: errorDescription.value || "Your account has been suspended.",
  },
  invite_only: {
    title: "Invite Required",
    description:
      errorDescription.value ||
      "This application is invite-only. Please request an invite to continue.",
  },
  default: {
    title: "Authentication Error",
    description:
      errorDescription.value || "An error occurred during authentication.",
  },
};

const currentError = computed(() => {
  const errorKey = error.value;
  const message = errorKey && errorMessages[errorKey];
  return message || errorMessages.default;
});
</script>

<template>
  <UPageCard>
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <UIcon name="i-lucide-shield-alert" class="w-16 h-16 text-error mb-6" />

      <h1 class="text-2xl font-bold mb-2">
        {{ currentError?.title }}
      </h1>

      <p class="text-muted max-w-md mb-8">
        {{ currentError?.description }}
      </p>

      <div class="flex gap-4">
        <UButton to="/" variant="solid" color="primary" label="Go to Home" />

        <UButton
          to="/login"
          variant="outline"
          color="neutral"
          label="Try Again"
        />
      </div>
    </div>
  </UPageCard>
</template>
