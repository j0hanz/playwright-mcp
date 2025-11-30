/**
 * Validation Schemas - Zod schemas for MCP Playwright Server
 */
import { z } from 'zod';

import { ARIA_ROLES } from '../config/types.js';

function toNonEmptyTuple<T extends readonly [string, ...string[]]>(arr: T): T {
  return arr;
}

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

export const timeoutSchema = z.number().min(100).max(120_000);

export const sessionIdSchema = z.string().uuid();
export const pageIdSchema = z.string().uuid();

export const browserTypeSchema = z.enum(['chromium', 'firefox', 'webkit']);

export const waitUntilSchema = z.enum([
  'load',
  'domcontentloaded',
  'networkidle',
  'commit',
]);

export const ariaRoleSchema = z.enum(
  toNonEmptyTuple(ARIA_ROLES as readonly [string, ...string[]])
);

export const mouseButtonSchema = z.enum(['left', 'middle', 'right']);
export const keyModifiersSchema = z.array(
  z.enum(['Alt', 'Control', 'Meta', 'Shift'])
);

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

export type ViewportInput = z.infer<typeof viewportSchema>;
export type PositionInput = z.infer<typeof positionSchema>;
export type TestScenarioInput = z.infer<typeof testScenarioSchema>;
