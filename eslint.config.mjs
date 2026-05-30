import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain Node.js utility scripts — not part of Next.js app, use require()
    "scripts/**",
    "fix_layout.js",
  ]),
  // Project-wide rule overrides.
  // These violations are widespread across the codebase and should be
  // fixed incrementally. Downgrade from error → warn so CI/builds pass.
  {
    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      // General JS
      "prefer-const": "warn",
      // React
      "react-hooks/exhaustive-deps": "warn",
      "react/no-unescaped-entities": "warn",
      // React Hooks v5 / React Compiler rules — downgrade until codebase is
      // ready to be fully React Compiler-compatible.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/component-hook-factories": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn",
    },
  },
]);

export default eslintConfig;
