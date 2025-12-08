// Test Tool Handlers - Test planning and file management for Playwright agents
// @see specs/ for test plans, tests/ for generated tests

import path from 'path';
import { z } from 'zod';

import type { ToolContext } from '../../config/types.js';
import { ErrorCode, ErrorHandler } from '../../utils/error-handler.js';
import {
  destructiveAnnotations,
  interactionAnnotations,
  readOnlyAnnotations,
} from './schemas.js';
import { textContent } from './types.js';

// ============================================================================
// Constants & Validation
// ============================================================================

const ALLOWED_DIRS = ['specs', 'tests'] as const;

/**
 * Validates that a file path is within allowed directories (specs/ or tests/).
 * Prevents path traversal attacks by resolving the path and checking containment.
 *
 * @param filePath - The relative file path to validate
 * @throws MCPPlaywrightError with SECURITY_VIOLATION if path escapes project root
 * @throws MCPPlaywrightError with VALIDATION_FAILED if path is not in allowed directory
 */
function validateArtifactPath(filePath: string): void {
  const projectRoot = process.cwd();
  const resolvedPath = path.resolve(projectRoot, filePath);

  // Security check: Ensure resolved path is within project root
  // This prevents path traversal attacks like '../../../etc/passwd'
  if (
    !resolvedPath.startsWith(projectRoot + path.sep) &&
    resolvedPath !== projectRoot
  ) {
    throw ErrorHandler.createError(
      ErrorCode.SECURITY_VIOLATION,
      `Path traversal detected: ${filePath}`
    );
  }

  const isAllowed = ALLOWED_DIRS.some((dir) => {
    const allowedAbsPath = path.resolve(projectRoot, dir);
    return (
      resolvedPath === allowedAbsPath ||
      resolvedPath.startsWith(allowedAbsPath + path.sep)
    );
  });

  if (!isAllowed) {
    throw ErrorHandler.createError(
      ErrorCode.VALIDATION_FAILED,
      `Path must be within ${ALLOWED_DIRS.join(' or ')} directory: ${filePath}`
    );
  }
}

/** Sanitize filename to be safe for filesystem */
const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

// ============================================================================
// Schemas - Centralized for DRY compliance
// ============================================================================

const schemas = {
  // Common output schemas
  fileResult: {
    success: z.boolean(),
    path: z.string(),
    filename: z.string(),
  },
  updateResult: {
    success: z.boolean(),
    path: z.string(),
    updated: z.boolean(),
  },
  readResult: {
    success: z.boolean(),
    path: z.string(),
    content: z.string(),
    lines: z.number(),
  },
  listResult: {
    success: z.boolean(),
    specs: z.array(z.string()),
    tests: z.array(z.string()),
    total: z.number(),
  },
  deleteResult: {
    success: z.boolean(),
    deleted: z.boolean(),
    path: z.string(),
  },

  // Input schemas
  testPlanInput: {
    name: z
      .string()
      .describe('Test plan name (e.g., Authentication Flow, Shopping Cart)'),
    description: z.string().describe('High-level description of the test plan'),
    scenarios: z
      .array(
        z.object({
          title: z.string(),
          steps: z.array(z.string()),
          expected: z.string(),
        })
      )
      .describe('List of test scenarios'),
  },
  testFileInput: {
    name: z
      .string()
      .describe(
        'Test file name (e.g., add-todo, login-valid). Will be saved as tests/{name}.spec.ts'
      ),
    content: z.string().describe('TypeScript test file content'),
  },
  updateFileInput: {
    path: z
      .string()
      .describe('Relative path to test file (e.g., tests/add-todo.spec.ts)'),
    content: z.string().describe('Updated test file content'),
    reason: z
      .string()
      .optional()
      .describe('Reason for update (e.g., "Fixed broken locator")'),
  },
  pathInput: {
    path: z
      .string()
      .describe(
        'Relative path to test file (e.g., tests/add-todo.spec.ts, specs/login-flow.md)'
      ),
  },
  listTypeInput: {
    type: z
      .enum(['all', 'specs', 'tests'])
      .default('all')
      .describe('Which artifacts to list'),
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

function generateTestPlanMarkdown(
  name: string,
  description: string,
  scenarios: Array<{ title: string; steps: string[]; expected: string }>
): string {
  return `# ${name}

> ${description}

## Test Scenarios

${scenarios
  .map(
    (s, i) => `### ${i + 1}. ${s.title}

**Steps:**
${s.steps.map((step) => `- ${step}`).join('\n')}

**Expected Result:**
${s.expected}
`
  )
  .join('\n')}
`;
}

export function registerTestTools(ctx: ToolContext): void {
  const { server, createToolHandler, logger } = ctx;

  // ============================================================================
  // Test Plan Management
  // ============================================================================

  server.registerTool(
    'test_plan_create',
    {
      title: 'Create Test Plan',
      description:
        'Create a structured test plan in Markdown format. Used by the Playwright Test Planner agent.',
      annotations: interactionAnnotations,
      inputSchema: schemas.testPlanInput,
      outputSchema: schemas.fileResult,
    },
    createToolHandler(async ({ name, description, scenarios }) => {
      const { promises: fs } = await import('fs');

      const safeFileName = sanitizeFileName(name);
      const filePath = `specs/${safeFileName}.md`;
      const content = generateTestPlanMarkdown(name, description, scenarios);

      await fs.mkdir('specs', { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');

      return {
        content: [textContent(`Test plan created: ${filePath}`)],
        structuredContent: {
          success: true,
          path: filePath,
          filename: `${safeFileName}.md`,
        },
      };
    }, 'Error creating test plan')
  );

  // ============================================================================
  // Test File Management
  // ============================================================================

  server.registerTool(
    'test_file_create',
    {
      title: 'Create Test File',
      description:
        'Create a Playwright test specification file generated by the Playwright Test Generator agent',
      annotations: interactionAnnotations,
      inputSchema: schemas.testFileInput,
      outputSchema: schemas.fileResult,
    },
    createToolHandler(async ({ name, content }) => {
      const { promises: fs } = await import('fs');

      const safeFileName = sanitizeFileName(name);
      const filePath = `tests/${safeFileName}.spec.ts`;

      await fs.mkdir('tests', { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');

      return {
        content: [textContent(`Test file created: ${filePath}`)],
        structuredContent: {
          success: true,
          path: filePath,
          filename: `${safeFileName}.spec.ts`,
        },
      };
    }, 'Error creating test file')
  );

  server.registerTool(
    'test_file_update',
    {
      title: 'Update Test File',
      description:
        'Update an existing Playwright test file. Used by the Healer agent to fix failing tests.',
      annotations: interactionAnnotations,
      inputSchema: schemas.updateFileInput,
      outputSchema: schemas.updateResult,
    },
    createToolHandler(async ({ path: filePath, content, reason }) => {
      const { promises: fs } = await import('fs');

      validateArtifactPath(filePath);
      await fs.writeFile(filePath, content, 'utf-8');

      logger.info('Test file updated', {
        path: filePath,
        reason: reason || 'no reason provided',
      });

      return {
        content: [
          textContent(
            `Test file updated: ${filePath}${reason ? ` (${reason})` : ''}`
          ),
        ],
        structuredContent: { success: true, path: filePath, updated: true },
      };
    }, 'Error updating test file')
  );

  server.registerTool(
    'test_file_read',
    {
      title: 'Read Test File',
      description:
        'Read the content of a test specification file. Used by agents to understand existing tests.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.pathInput,
      outputSchema: schemas.readResult,
    },
    createToolHandler(async ({ path: filePath }) => {
      const { promises: fs } = await import('fs');

      validateArtifactPath(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').length;

      return {
        content: [textContent(`Read ${filePath} (${lines} lines)`)],
        structuredContent: { success: true, path: filePath, content, lines },
      };
    }, 'Error reading test file')
  );

  // ============================================================================
  // Artifact Listing & Deletion
  // ============================================================================

  server.registerTool(
    'test_artifacts_list',
    {
      title: 'List Test Artifacts',
      description:
        'List all test plans and test files in the project. Returns specs/ and tests/ directories.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.listTypeInput,
      outputSchema: schemas.listResult,
    },
    createToolHandler(async ({ type }) => {
      const { promises: fs } = await import('fs');

      const specs: string[] = [];
      const tests: string[] = [];

      const readDir = async (
        dir: string,
        extension: string
      ): Promise<string[]> => {
        try {
          const files = await fs.readdir(dir);
          return files.filter((f) => f.endsWith(extension));
        } catch {
          return []; // Directory might not exist yet
        }
      };

      if (type === 'all' || type === 'specs') {
        specs.push(...(await readDir('specs', '.md')));
      }

      if (type === 'all' || type === 'tests') {
        tests.push(...(await readDir('tests', '.spec.ts')));
      }

      const total = specs.length + tests.length;

      return {
        content: [
          textContent(
            `Found ${specs.length} test plan(s) and ${tests.length} test file(s)`
          ),
        ],
        structuredContent: { success: true, specs, tests, total },
      };
    }, 'Error listing test artifacts')
  );

  server.registerTool(
    'test_artifact_delete',
    {
      title: 'Delete Test Artifact',
      description: 'Delete a test plan or test file',
      annotations: destructiveAnnotations,
      inputSchema: schemas.pathInput,
      outputSchema: schemas.deleteResult,
    },
    createToolHandler(async ({ path: filePath }) => {
      const { promises: fs } = await import('fs');

      try {
        validateArtifactPath(filePath);
        await fs.unlink(filePath);
        logger.info('Test artifact deleted', { path: filePath });

        return {
          content: [textContent(`Deleted: ${filePath}`)],
          structuredContent: { success: true, deleted: true, path: filePath },
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return {
          content: [
            textContent(`Failed to delete ${filePath}: ${err.message}`),
          ],
          structuredContent: { success: false, deleted: false, path: filePath },
        };
      }
    }, 'Error deleting test artifact')
  );
}
