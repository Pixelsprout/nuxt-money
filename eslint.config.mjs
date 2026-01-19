import { createConfigForNuxt } from "@nuxt/eslint-config/flat";

export default createConfigForNuxt({
  features: {
    stylistic: {
      quotes: "double",
      semi: "always",
    },
  },
});
