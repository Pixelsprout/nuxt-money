<script setup lang="ts">
import { signIn } from "~/lib/auth-client";

definePageMeta({ layout: false });

const providers = [
  {
    label: "Google",
    icon: "i-simple-icons-google",
    color: "neutral" as const,
    variant: "subtle" as const,
    onClick: async () => {
      await signIn.social({ provider: "google", callbackURL: "/" });
    },
  },
];
</script>

<template>
  <div class="min-h-dvh flex items-center justify-center p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        title="Login"
        description="Sign in with your Google account to continue."
        icon="i-lucide-user"
        :providers="providers"
        :fields="[]"
      />
    </UPageCard>
  </div>
</template>
