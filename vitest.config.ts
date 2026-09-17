import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Root-only option (ignored inside projects). The db files share one
    // database and reset it in beforeEach, so files must run one at a time.
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["test/api/**/*.test.ts", "test/integration/**/*.test.ts"],
          setupFiles: ["test/support/dbGuard.ts"],
        },
      },
    ],
  },
});
