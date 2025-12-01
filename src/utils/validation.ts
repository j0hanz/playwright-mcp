/**
 * Validation Schemas - Reusable Zod schemas for MCP Playwright Server
 *
 * NOTE: viewportSchema, positionSchema, and testScenarioSchema are defined
 * in '../config/types.js' as the single source of truth. Import from there.
 *
 * This file contains additional validation schemas for specific use cases.
 */
import { z } from 'zod';

import {
  ARIA_ROLES,
  viewportSchema,
  positionSchema,
  testScenarioSchema,
  type ViewportInput,
  type PositionInput,
  type TestScenarioInput,
} from '../config/types.js';

// Re-export from types.ts for backwards compatibility
export { viewportSchema, positionSchema, testScenarioSchema };
export type { ViewportInput, PositionInput, TestScenarioInput };

// Helper for creating non-empty tuples from const arrays
function toNonEmptyTuple<T extends readonly [string, ...string[]]>(arr: T): T {
  return arr;
}

// ============================================================================
// Primitive Validation Schemas
// ============================================================================

/** Timeout value in milliseconds (100ms to 120s) */
export const timeoutSchema = z.number().min(100).max(120_000);

/** UUID format validation for session IDs */
export const sessionIdSchema = z.string().uuid();

/** UUID format validation for page IDs */
export const pageIdSchema = z.string().uuid();

// ============================================================================
// Browser-related Schemas
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

// ============================================================================
// Accessibility Schemas
// ============================================================================

/** ARIA roles for accessibility locators */
export const ariaRoleSchema = z.enum(
  toNonEmptyTuple(ARIA_ROLES as readonly [string, ...string[]])
);

// ============================================================================
// Input Device Schemas
// ============================================================================

/** Mouse button options */
export const mouseButtonSchema = z.enum(['left', 'middle', 'right']);

/** Keyboard modifier keys */
export const keyModifiersSchema = z.array(
  z.enum(['Alt', 'Control', 'Meta', 'Shift'])
);
