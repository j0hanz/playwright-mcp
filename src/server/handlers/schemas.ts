// Centralized Zod Schemas - Single source of truth for all shared validation schemas
// @see https://zod.dev for Zod documentation
// @see https://playwright.dev/docs/locators for locator strategy documentation

import { z } from 'zod';

import { ARIA_ROLES } from '../../config/types.js';
import config from '../../config/server-config.js';

// ============================================================================
// Primitive Schemas
// ============================================================================

/** UUID format validation for session IDs */
export const sessionIdSchema = z.string().uuid();

/** UUID format validation for page IDs */
export const pageIdSchema = z.string().uuid();

/** Timeout value in milliseconds (100ms to 120s) */
export const timeoutSchema = z.number().min(100).max(120_000);

// ============================================================================
// Browser Schemas
// ============================================================================

/** Supported browser types */
export const browserTypeSchema = z.enum(['chromium', 'firefox', 'webkit']);

/** Navigation wait states */
export const waitUntilSchema = z.enum([
  'load',
  'domcontentloaded',
  'networkidle',
  'commit',
]);

/** Element visibility/interaction states */
export const elementStateSchema = z.enum([
  'visible',
  'hidden',
  'enabled',
  'disabled',
  'focused',
  'editable',
  'attached',
  'inViewport',
]);

/** Wait for selector states */
export const waitStateSchema = z.enum([
  'attached',
  'detached',
  'visible',
  'hidden',
]);

/** Load states for page_wait_for_load_state */
export const loadStateSchema = z.enum([
  'load',
  'domcontentloaded',
  'networkidle',
]);

/** Color scheme options */
export const colorSchemeSchema = z.enum(['light', 'dark', 'no-preference']);

/** Reduced motion preference */
export const reducedMotionSchema = z.enum(['reduce', 'no-preference']);

// ============================================================================
// Viewport and Position Schemas
// ============================================================================

export const viewportSchema = z.object({
  width: z
    .number()
    .int('Width must be an integer')
    .min(320, 'Width must be at least 320px')
    .max(3_840, 'Width must not exceed 3840px')
    .default(1_920),
  height: z
    .number()
    .int('Height must be an integer')
    .min(240, 'Height must be at least 240px')
    .max(2_160, 'Height must not exceed 2160px')
    .default(1_080),
});

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const clipRegionSchema = z.object({
  x: z.number().describe('X coordinate of the top-left corner'),
  y: z.number().describe('Y coordinate of the top-left corner'),
  width: z.number().describe('Width of the clipping region'),
  height: z.number().describe('Height of the clipping region'),
});

export const geolocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
});

// ============================================================================
// Locator Type Schemas
// ============================================================================

/**
 * Helper to cast a readonly string array to a Zod-compatible non-empty tuple.
 * Zod's z.enum() requires at least one element, so this ensures type safety.
 */
function asZodEnumTuple<T extends readonly [string, ...string[]]>(arr: T): T {
  return arr;
}

/** ARIA roles for accessibility locators */
export const ariaRoleSchema = z.enum(
  asZodEnumTuple(ARIA_ROLES as readonly [string, ...string[]])
);

/** Click locator types */
export const clickLocatorTypeSchema = z.enum([
  'selector',
  'role',
  'text',
  'testid',
  'altText',
  'title',
]);

/** Fill locator types */
export const fillLocatorTypeSchema = z.enum([
  'selector',
  'label',
  'placeholder',
  'testid',
]);

/** Hover locator types */
export const hoverLocatorTypeSchema = z.enum([
  'selector',
  'role',
  'text',
  'testid',
]);

// ============================================================================
// Input Device Schemas
// ============================================================================

/** Mouse button options */
export const mouseButtonSchema = z.enum(['left', 'middle', 'right']);

/** Keyboard modifier keys */
export const keyModifierSchema = z.enum(['Alt', 'Control', 'Meta', 'Shift']);

/** Array of keyboard modifiers */
export const keyModifiersSchema = z.array(keyModifierSchema);

// ============================================================================
// Screenshot Schemas
// ============================================================================

/** Image format for screenshots */
export const imageFormatSchema = z.enum(['png', 'jpeg']);

// ============================================================================
// Browser Launch Option Schemas
// ============================================================================

export const proxySchema = z
  .object({
    server: z.string().describe('Proxy server URL'),
    bypass: z.string().optional().describe('Domains to bypass proxy'),
    username: z.string().optional(),
    password: z.string().optional(),
  })
  .optional()
  .describe('Proxy configuration');

export const recordVideoSchema = z
  .object({
    dir: z.string().describe('Directory to save video recordings'),
    width: z.number().optional().describe('Video width (defaults to viewport)'),
    height: z
      .number()
      .optional()
      .describe('Video height (defaults to viewport)'),
  })
  .optional()
  .describe('Video recording configuration');

// ============================================================================
// Common Input Schema Compositions
// ============================================================================

/** Base page input - sessionId and pageId */
export const basePageInput = {
  sessionId: z.string().describe('Browser session ID'),
  pageId: z.string().describe('Page ID'),
} as const;

/** Timeout option with default from config */
export const timeoutOption = {
  timeout: z
    .number()
    .default(config.timeouts.action)
    .describe('Timeout in milliseconds'),
} as const;

/** Long timeout option (for navigation) with default from config */
export const longTimeoutOption = {
  timeout: z
    .number()
    .default(config.timeouts.navigation)
    .describe('Timeout in milliseconds'),
} as const;

/** Force option for interactions */
export const forceOption = {
  force: z
    .boolean()
    .default(false)
    .describe('Force action even if element is not actionable'),
} as const;

/** Exact match option for text matching */
export const exactMatchOption = {
  exact: z.boolean().default(false).describe('Whether match should be exact'),
} as const;

/** Selector input - base page input + selector */
export const selectorInput = {
  ...basePageInput,
  selector: z.string().describe('CSS selector for the element'),
} as const;

/** Base locator input - base page input + timeout */
export const baseLocatorInput = {
  ...basePageInput,
  ...timeoutOption,
} as const;

/** Selector with timeout - selector input + timeout */
export const selectorWithTimeout = {
  ...selectorInput,
  ...timeoutOption,
} as const;

// ============================================================================
// Retry Configuration Schema
// ============================================================================

/** Retry configuration for flaky operations */
export const retryOptions = {
  retries: z
    .number()
    .min(0)
    .max(5)
    .default(0)
    .describe('Number of retry attempts for flaky operations (0-5)'),
  retryDelay: z
    .number()
    .min(100)
    .max(5000)
    .default(500)
    .describe('Delay between retries in milliseconds'),
} as const;

/** Retry schema object for use in tool inputs */
export const retrySchema = z.object({
  retries: z.number().min(0).max(5).default(0),
  retryDelay: z.number().min(100).max(5000).default(500),
});

// ============================================================================
// Accessibility Scan Schemas
// ============================================================================

export const a11yImpactSchema = z.enum([
  'minor',
  'moderate',
  'serious',
  'critical',
]);

export const a11yTagsSchema = z.array(z.string());

// ============================================================================
// Test Scenario Schema (for test file generation)
// ============================================================================

export const testScenarioSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  baseUrl: z.string().url(),
  steps: z.array(
    z.object({
      action: z.enum([
        'navigate',
        'click',
        'fill',
        'type',
        'hover',
        'select',
        'check',
        'uncheck',
        'screenshot',
        'wait',
        'scroll',
        'press',
      ]),
      target: z.string().optional(),
      value: z.string().optional(),
      timeout: z.number().min(100).max(120_000).optional(),
      assertions: z
        .array(
          z.object({
            type: z.enum([
              'visible',
              'hidden',
              'text',
              'attribute',
              'url',
              'title',
              'screenshot',
            ]),
            target: z.string().optional(),
            expected: z.string().optional(),
            attribute: z.string().optional(),
          })
        )
        .optional(),
    })
  ),
  tags: z.array(z.string()).optional(),
});

// ============================================================================
// Tool Annotation Schemas (MCP Spec Compliance)
// @see https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-annotations
// ============================================================================

/**
 * Tool annotations provide hints about tool behavior to clients.
 * These are hints and should not be relied upon for security decisions.
 */
export interface ToolAnnotations {
  /** If true, the tool does not modify its environment */
  readOnlyHint?: boolean;
  /** If true, the tool may perform destructive updates (only meaningful when readOnlyHint is false) */
  destructiveHint?: boolean;
  /** If true, repeated calls with same args have no additional effect (only meaningful when readOnlyHint is false) */
  idempotentHint?: boolean;
  /** If true, the tool interacts with external entities */
  openWorldHint?: boolean;
}

/** Annotations for read-only tools (assertions, screenshots, queries) */
export const readOnlyAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** Annotations for browser interaction tools (click, fill, navigate) */
export const interactionAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

/** Annotations for browser lifecycle tools (launch, close) */
export const lifecycleAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

/** Annotations for destructive tools (close, clear) */
export const destructiveAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

/** Annotations for idempotent navigation tools */
export const navigationAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type BrowserTypeInput = z.infer<typeof browserTypeSchema>;
export type WaitUntilInput = z.infer<typeof waitUntilSchema>;
export type ElementStateInput = z.infer<typeof elementStateSchema>;
export type ViewportInput = z.infer<typeof viewportSchema>;
export type PositionInput = z.infer<typeof positionSchema>;
export type AriaRoleInput = z.infer<typeof ariaRoleSchema>;
export type TestScenarioInput = z.infer<typeof testScenarioSchema>;
