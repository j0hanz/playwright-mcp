// Assertion Tool Handlers - Web-first assertions following Playwright best practices
// @see https://playwright.dev/docs/test-assertions

import { z } from 'zod';

import type { ToolContext } from '../../config/types.js';
import { baseLocatorInput, selectorWithTimeout, textContent } from './types.js';

// ============================================================================
// Schemas - Centralized for DRY compliance
// ============================================================================

// Element state enum for consolidated state assertions
const elementStateSchema = z
  .enum([
    'visible',
    'hidden',
    'enabled',
    'disabled',
    'focused',
    'editable',
    'attached',
    'inViewport',
  ])
  .describe('Expected element state');

const schemas = {
  // Consolidated element state assertion
  withState: {
    ...selectorWithTimeout,
    state: elementStateSchema,
  },
  // Input schemas with expected values
  withExpectedText: {
    ...selectorWithTimeout,
    expectedText: z
      .string()
      .describe('Expected text content (or regex pattern if useRegex is true)'),
    exact: z
      .boolean()
      .default(false)
      .describe('Whether to match exact text or just contain'),
    useRegex: z
      .boolean()
      .default(false)
      .describe('Treat expectedText as a regular expression pattern'),
  },
  withExpectedValue: {
    ...selectorWithTimeout,
    expectedValue: z.string().describe('Expected input value'),
  },
  withAttribute: {
    ...selectorWithTimeout,
    attribute: z.string().describe('Attribute name'),
    expectedValue: z.string().describe('Expected attribute value'),
  },
  withCheckedState: {
    ...selectorWithTimeout,
    checked: z.boolean().default(true).describe('Expected checked state'),
  },
  withExpectedUrl: {
    ...baseLocatorInput,
    expectedUrl: z
      .string()
      .describe(
        'Expected URL (exact string or regex pattern if useRegex is true)'
      ),
    useRegex: z
      .boolean()
      .default(false)
      .describe('Treat expectedUrl as a regular expression pattern'),
  },
  withExpectedTitle: {
    ...baseLocatorInput,
    expectedTitle: z
      .string()
      .describe('Expected page title (or regex pattern if useRegex is true)'),
    useRegex: z
      .boolean()
      .default(false)
      .describe('Treat expectedTitle as a regular expression pattern'),
  },
  withExpectedCount: {
    ...selectorWithTimeout,
    expectedCount: z.number().describe('Expected number of elements'),
  },
  withCssProperty: {
    ...selectorWithTimeout,
    property: z
      .string()
      .describe('CSS property name (e.g., "color", "display")'),
    expectedValue: z.string().describe('Expected CSS property value'),
  },

  // Output schemas - reusable result patterns
  stateResult: {
    success: z.boolean(),
    state: elementStateSchema,
    matches: z.boolean(),
  },
  comparisonResult: (key: string) => ({
    success: z.boolean(),
    [key]: z.string().optional(),
  }),
  countResult: { success: z.boolean(), actualCount: z.number() },
} as const;

// ============================================================================
// Result Message Formatters
// ============================================================================

const formatResult = {
  /** Format state assertions (visible/hidden/enabled/disabled/focused) */
  state: (selector: string, state: string, success: boolean) =>
    success
      ? `✓ Element ${selector} is ${state}`
      : `✗ Element ${selector} is NOT ${state}`,

  /** Format comparison assertions (expected vs actual) */
  comparison: (
    label: string,
    expected: string,
    actual: string | undefined,
    success: boolean
  ) =>
    success
      ? `✓ ${label} matches "${expected}"`
      : `✗ Expected ${label} "${expected}", got "${actual}"`,

  /** Format simple pass/fail with custom message */
  simple: (passMessage: string, failMessage: string, success: boolean) =>
    success ? `✓ ${passMessage}` : `✗ ${failMessage}`,
};

export function registerAssertionTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // ============================================================================
  // Consolidated Element State Assertion
  // ============================================================================

  server.registerTool(
    'assert_element',
    {
      title: 'Assert Element State',
      description: `Assert that an element is in a specific state (web-first assertion with auto-waiting).
States:
- 'visible': Element is visible on the page
- 'hidden': Element is hidden or not present
- 'enabled': Element is enabled (for interactive elements)
- 'disabled': Element is disabled
- 'focused': Element has focus
- 'editable': Element is editable (for inputs)
- 'attached': Element is attached to DOM
- 'inViewport': Element is visible in the viewport`,
      inputSchema: schemas.withState,
      outputSchema: schemas.stateResult,
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, state, timeout }) => {
        let result: { success: boolean };

        switch (state) {
          case 'visible':
            result = await browserManager.assertionActions.assertVisible(
              sessionId,
              pageId,
              selector,
              { timeout }
            );
            break;
          case 'hidden':
            result = await browserManager.assertionActions.assertHidden(
              sessionId,
              pageId,
              selector,
              { timeout }
            );
            break;
          case 'enabled':
            result = await browserManager.assertionActions.assertEnabled(
              sessionId,
              pageId,
              selector,
              { timeout }
            );
            break;
          case 'disabled':
            result = await browserManager.assertionActions.assertDisabled(
              sessionId,
              pageId,
              selector,
              { timeout }
            );
            break;
          case 'focused':
            result = await browserManager.assertionActions.assertFocused(
              sessionId,
              pageId,
              selector,
              { timeout }
            );
            break;
          case 'editable':
            result = await browserManager.assertionActions.assertEditable(
              sessionId,
              pageId,
              selector,
              { timeout }
            );
            break;
          case 'attached':
            result = await browserManager.assertionActions.assertAttached(
              sessionId,
              pageId,
              selector,
              { timeout }
            );
            break;
          case 'inViewport':
            result = await browserManager.assertionActions.assertInViewport(
              sessionId,
              pageId,
              selector,
              { timeout }
            );
            break;
        }

        return {
          content: [
            textContent(formatResult.state(selector, state, result.success)),
          ],
          structuredContent: { ...result, state, matches: result.success },
        };
      },
      'Error asserting element state'
    )
  );

  // ============================================================================
  // Text/Value Comparison Assertions
  // ============================================================================

  server.registerTool(
    'assert_text',
    {
      title: 'Assert Element Text',
      description:
        'Assert that an element has or contains specific text (web-first assertion). Supports regex patterns.',
      inputSchema: schemas.withExpectedText,
      outputSchema: schemas.comparisonResult('actualText'),
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        selector,
        expectedText,
        exact,
        useRegex,
        timeout,
      }) => {
        const result = useRegex
          ? await browserManager.assertionActions.assertTextWithRegex(
              sessionId,
              pageId,
              selector,
              expectedText,
              { timeout }
            )
          : await browserManager.assertionActions.assertText(
              sessionId,
              pageId,
              selector,
              expectedText,
              { exact, timeout }
            );
        return {
          content: [
            textContent(
              formatResult.comparison(
                useRegex ? 'text (regex)' : 'text',
                expectedText,
                result.actualText,
                result.success
              )
            ),
          ],
          structuredContent: result,
        };
      },
      'Error asserting text'
    )
  );

  server.registerTool(
    'assert_value',
    {
      title: 'Assert Input Value',
      description: 'Assert that an input element has a specific value',
      inputSchema: schemas.withExpectedValue,
      outputSchema: schemas.comparisonResult('actualValue'),
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, expectedValue, timeout }) => {
        const result = await browserManager.assertionActions.assertValue(
          sessionId,
          pageId,
          selector,
          expectedValue,
          { timeout }
        );
        return {
          content: [
            textContent(
              formatResult.comparison(
                'value',
                expectedValue,
                result.actualValue,
                result.success
              )
            ),
          ],
          structuredContent: result,
        };
      },
      'Error asserting value'
    )
  );

  server.registerTool(
    'assert_attribute',
    {
      title: 'Assert Element Attribute',
      description: 'Assert that an element has a specific attribute value',
      inputSchema: schemas.withAttribute,
      outputSchema: schemas.comparisonResult('actualValue'),
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        selector,
        attribute,
        expectedValue,
        timeout,
      }) => {
        const result = await browserManager.assertionActions.assertAttribute(
          sessionId,
          pageId,
          selector,
          attribute,
          expectedValue,
          { timeout }
        );
        return {
          content: [
            textContent(
              formatResult.comparison(
                attribute,
                expectedValue,
                result.actualValue,
                result.success
              )
            ),
          ],
          structuredContent: result,
        };
      },
      'Error asserting attribute'
    )
  );

  server.registerTool(
    'assert_css',
    {
      title: 'Assert CSS Property',
      description: 'Assert that an element has a specific CSS property value',
      inputSchema: schemas.withCssProperty,
      outputSchema: schemas.comparisonResult('actualValue'),
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        selector,
        property,
        expectedValue,
        timeout,
      }) => {
        const result = await browserManager.assertionActions.assertCss(
          sessionId,
          pageId,
          selector,
          property,
          expectedValue,
          { timeout }
        );
        return {
          content: [
            textContent(
              formatResult.comparison(
                `CSS ${property}`,
                expectedValue,
                result.actualValue,
                result.success
              )
            ),
          ],
          structuredContent: result,
        };
      },
      'Error asserting CSS'
    )
  );

  // ============================================================================
  // Page-Level Assertions
  // ============================================================================

  server.registerTool(
    'assert_url',
    {
      title: 'Assert Page URL',
      description:
        'Assert that the page has a specific URL. Supports regex patterns.',
      inputSchema: schemas.withExpectedUrl,
      outputSchema: schemas.comparisonResult('actualUrl'),
    },
    createToolHandler(
      async ({ sessionId, pageId, expectedUrl, useRegex, timeout }) => {
        const result = useRegex
          ? await browserManager.assertionActions.assertUrlWithRegex(
              sessionId,
              pageId,
              expectedUrl,
              { timeout }
            )
          : await browserManager.assertionActions.assertUrl(
              sessionId,
              pageId,
              expectedUrl,
              { timeout }
            );
        return {
          content: [
            textContent(
              formatResult.comparison(
                useRegex ? 'URL (regex)' : 'URL',
                expectedUrl,
                result.actualUrl,
                result.success
              )
            ),
          ],
          structuredContent: result,
        };
      },
      'Error asserting URL'
    )
  );

  server.registerTool(
    'assert_title',
    {
      title: 'Assert Page Title',
      description:
        'Assert that the page has a specific title. Supports regex patterns.',
      inputSchema: schemas.withExpectedTitle,
      outputSchema: schemas.comparisonResult('actualTitle'),
    },
    createToolHandler(
      async ({ sessionId, pageId, expectedTitle, useRegex, timeout }) => {
        const result = useRegex
          ? await browserManager.assertionActions.assertTitleWithRegex(
              sessionId,
              pageId,
              expectedTitle,
              { timeout }
            )
          : await browserManager.assertionActions.assertTitle(
              sessionId,
              pageId,
              expectedTitle,
              { timeout }
            );
        return {
          content: [
            textContent(
              formatResult.comparison(
                useRegex ? 'title (regex)' : 'title',
                expectedTitle,
                result.actualTitle,
                result.success
              )
            ),
          ],
          structuredContent: result,
        };
      },
      'Error asserting title'
    )
  );

  // ============================================================================
  // Special Assertions
  // ============================================================================

  server.registerTool(
    'assert_checked',
    {
      title: 'Assert Checkbox Checked',
      description:
        'Assert that a checkbox or radio button is checked or unchecked',
      inputSchema: schemas.withCheckedState,
      outputSchema: { success: z.boolean(), isChecked: z.boolean().optional() },
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, checked, timeout }) => {
        const result = await browserManager.assertionActions.assertChecked(
          sessionId,
          pageId,
          selector,
          checked,
          { timeout }
        );
        const expectedState = checked ? 'checked' : 'unchecked';
        const actualState = result.isChecked ? 'checked' : 'unchecked';
        return {
          content: [
            textContent(
              formatResult.simple(
                `Element is ${expectedState}`,
                `Expected ${expectedState}, got ${actualState}`,
                result.success
              )
            ),
          ],
          structuredContent: result,
        };
      },
      'Error asserting checked'
    )
  );

  server.registerTool(
    'assert_count',
    {
      title: 'Assert Element Count',
      description:
        'Assert that the number of elements matching the selector equals expected count',
      inputSchema: schemas.withExpectedCount,
      outputSchema: schemas.countResult,
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, expectedCount, timeout }) => {
        const result = await browserManager.assertionActions.assertCount(
          sessionId,
          pageId,
          selector,
          expectedCount,
          { timeout }
        );
        return {
          content: [
            textContent(
              formatResult.simple(
                `Found ${expectedCount} element(s) matching ${selector}`,
                `Expected ${expectedCount} element(s), found ${result.actualCount}`,
                result.success
              )
            ),
          ],
          structuredContent: result,
        };
      },
      'Error asserting count'
    )
  );
}
