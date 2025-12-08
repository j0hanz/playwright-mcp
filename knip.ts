/**
 * Knip Configuration
 *
 * Finds unused files, dependencies, and exports.
 * Rules are stricter in CI (error) vs local development (warn).
 *
 * @see https://knip.dev/reference/configuration
 */
import type { KnipConfig } from 'knip';

const isCI = !!process.env.CI;

const config: KnipConfig = {
  $schema: 'https://unpkg.com/knip@5/schema.json',

  entry: ['src/index.ts', 'pages/**/*.ts', 'src/config/playwright-config.ts'],

  project: ['src/**/*.ts', 'pages/**/*.ts', 'tests/**/*.ts'],

  ignore: ['dist/**', 'src/**/*.generated.ts', 'fixtures/**'],

  ignoreIssues: {
    'src/config/types.ts': ['exports', 'types'],
    'src/config/server-config.ts': ['exports', 'duplicates'],
    'src/server/handlers/schemas.ts': ['exports', 'types'],
    'src/server/handlers/types.ts': ['exports'],
    'src/playwright/security.ts': ['exports'],
    'src/utils/constants.ts': ['exports'],
    'src/utils/error-handler.ts': ['exports'],
    'src/config/playwright-config.ts': ['exports', 'types'],
  },

  ignoreExportsUsedInFile: { interface: true, type: true },

  tags: ['-lintignore', '-public', '-internal'],

  ignoreDependencies: [],
  ignoreBinaries: ['run'],

  playwright: {
    config: ['playwright.config.ts'],
    entry: ['tests/**/*.{spec,test}.ts'],
  },
  eslint: { config: ['eslint.config.mjs'] },
  typescript: { config: ['tsconfig.json'] },

  rules: {
    files: isCI ? 'error' : 'warn',
    dependencies: isCI ? 'error' : 'warn',
    devDependencies: isCI ? 'error' : 'warn',
    optionalPeerDependencies: 'off',
    unlisted: isCI ? 'error' : 'warn',
    binaries: isCI ? 'error' : 'warn',
    exports: isCI ? 'error' : 'warn',
    types: isCI ? 'error' : 'warn',
    nsExports: 'off',
    nsTypes: 'off',
    classMembers: 'off',
    enumMembers: 'warn',
    duplicates: 'warn',
    unresolved: isCI ? 'error' : 'warn',
  },

  exclude: ['classMembers'],
  includeEntryExports: false,
  treatConfigHintsAsErrors: isCI,
};

export default config;
