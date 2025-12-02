import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // Global ignores
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'reports/**'],
  },

  // Base JS recommended config
  eslint.configs.recommended,

  // TypeScript recommended config
  ...tseslint.configs.recommended,

  // TypeScript strict type-checked config for src files only
  {
    files: ['src/**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // HIGH: TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',

      // MEDIUM: Clean code
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-require-imports': 'off',

      // Allow floating promises in specific patterns (IIFE in setInterval)
      '@typescript-eslint/no-floating-promises': [
        'error',
        { ignoreVoid: true },
      ],

      // Relax some rules for this project
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false },
      ],
    },
  },

  // TypeScript config for test files and config files (no type-checking)
  {
    files: ['tests/**/*.ts', '*.config.ts', '*.config.mjs'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
    },
  },

  // Playwright test best practices - enforce stable test patterns
  {
    files: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    rules: {
      // Ban .only() and .skip() to prevent accidental test filtering
      'no-restricted-properties': [
        'warn',
        {
          object: 'test',
          property: 'only',
          message:
            '⚠️  test.only() will skip all other tests. Remove before committing.',
        },
        {
          object: 'test',
          property: 'skip',
          message:
            '⚠️  test.skip() found. Ensure this is intentional - add comment explaining why. Use test.fixme() for known issues.',
        },
      ],
    },
  },

  // Relax unsafe-any rules for handler files (ToolContext uses `any` to avoid circular deps)
  {
    files: ['src/server/handlers/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // Prettier config (must be last to override formatting rules)
  eslintConfigPrettier
);
