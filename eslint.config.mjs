import path from "node:path";

import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { configs, plugins, rules } from "eslint-config-airbnb-extended";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const jsConfig = defineConfig([
  {
    name: "js/config",
    ...js.configs.recommended,
  },
  plugins.stylistic,
  plugins.importX,
  ...configs.base.recommended,
  rules.base.importsStrict,
]);

const nodeConfig = defineConfig([
  plugins.node,
  ...configs.node.recommended,
]);

const typescriptConfig = defineConfig([
  plugins.typescriptEslint,
  ...configs.base.typescript,
  rules.typescript.typescriptEslintStrict,
]);

export default defineConfig([
  includeIgnoreFile(gitignorePath),
  ...jsConfig,
  ...nodeConfig,
  ...typescriptConfig,
  {
    name: "biome-compat/disable-formatting-rules",
    rules: {
      "@stylistic/indent": "off",
      "@stylistic/quotes": "off",
      "@stylistic/semi": "off",
      "@stylistic/comma-dangle": "off",
      "@stylistic/arrow-parens": "off",
      "@stylistic/object-curly-spacing": "off",
      "@stylistic/object-curly-newline": "off",
      "@stylistic/operator-linebreak": "off",
      "@stylistic/newline-per-chained-call": "off",
      "@stylistic/no-extra-semi": "off",
      "@stylistic/no-trailing-spaces": "off",
      "@stylistic/eol-last": "off",
      "@stylistic/max-len": "off",
      "import-x/order": "off",
    },
  },
  {
    name: "cli/allow-console",
    files: ["src/cli/**/*.ts", "src/main.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    name: "cli/allow-hashbang",
    files: ["src/main.ts"],
    rules: {
      "n/hashbang": "off",
    },
  },
]);
