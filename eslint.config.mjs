import tseslint from "typescript-eslint";
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/admin/**",
      "apps/rider/scripts/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-unreachable": "error",
      "no-constant-binary-expression": "error",
    },
  },
  { files: ["**/*.cjs"], languageOptions: { sourceType: "commonjs" } },
];
