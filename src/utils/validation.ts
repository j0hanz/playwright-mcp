import { z } from 'zod';

import { ARIA_ROLES } from '../types/index.js';

// Helper to create a non-empty tuple type from a readonly array
// This avoids the unsafe `as unknown as` double assertion
function toNonEmptyTuple<T extends readonly [string, ...string[]]>(arr: T): T {
  return arr;
}

// Viewport schema - reusable
// Note: .default() applies AFTER validation, so constraints apply to defaults too
export const viewportSchema = z.object({
  width: z
    .number()
    .int('Width must be an integer')
    .min(320, 'Width must be at least 320px')
    .max(3840, 'Width must not exceed 3840px')
    .default(1920),
  height: z
    .number()
    .int('Height must be an integer')
    .min(240, 'Height must be at least 240px')
    .max(2160, 'Height must not exceed 2160px')
    .default(1080),
});

// Position schema - reusable
export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// Common timeout constraints
export const timeoutSchema = z.number().min(100).max(120000);

// Session/Page ID validation
export const sessionIdSchema = z.string().uuid();
export const pageIdSchema = z.string().uuid();

// Browser type enum
export const browserTypeSchema = z.enum(['chromium', 'firefox', 'webkit']);

// Wait until state
export const waitUntilSchema = z.enum([
  'load',
  'domcontentloaded',
  'networkidle',
  'commit',
]);

// ARIA roles schema (derived from const array for single source of truth)
// The ARIA_ROLES array is guaranteed to be non-empty, so we assert that property
export const ariaRoleSchema = z.enum(
  toNonEmptyTuple(ARIA_ROLES as readonly [string, ...string[]])
);

// Mouse button and modifiers
export const mouseButtonSchema = z.enum(['left', 'middle', 'right']);
export const keyModifiersSchema = z.array(
  z.enum(['Alt', 'Control', 'Meta', 'Shift'])
);

// Test scenario schema (complex, not duplicated in mcp-server.ts)
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
      timeout: timeoutSchema.optional(),
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

// Type exports
export type ViewportInput = z.infer<typeof viewportSchema>;
export type PositionInput = z.infer<typeof positionSchema>;
export type TestScenarioInput = z.infer<typeof testScenarioSchema>;
