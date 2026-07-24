import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const flatCompat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...flatCompat.extends("next/core-web-vitals", "next/typescript"),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
];

export default eslintConfig;
