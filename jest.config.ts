import type { Config } from "jest";
import nextJest from "next/jest.js";

// Testes rodam sem banco real: cada suíte sobe um Postgres em memória
// (pg-mem) e executa o SQL de verdade gerado pelo Drizzle.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  setupFiles: ["<rootDir>/jest.setup.ts"],
  // alias do tsconfig (`@/*` → `./src/*`) — o next/jest do Next 16 não repassa
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default createJestConfig(config);
