import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "app/frontend/src/**/*.test.tsx"],
    environment: "jsdom",
    globals: false,
  },
});
