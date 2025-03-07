import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default [
  // Top-level ignores configuration
  {
    ignores: [
      'node_modules/**',
      'dist/**', // This should ignore all files in the dist directory
      'coverage/**',
      'README.md',
      'package.json',
      'package-lock.json',
    ]
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImportsPlugin
    },
    settings: {
      'import/resolver': {
        typescript: {}
      }
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
    },
    rules: {
      "no-param-reassign": "error",
      '@typescript-eslint/no-unused-vars': "error"
    },
  },
  prettierConfig
];