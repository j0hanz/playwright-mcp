// Page Tool Handlers - Screenshots, content, waiting, and accessibility tools
// @see https://playwright.dev/docs/api/class-page

import { z } from 'zod';

import type { ToolContext } from '../../config/types.js';
import {
  a11yImpactSchema,
  basePageInput,
  clipRegionSchema,
  imageFormatSchema,
  interactionAnnotations,
  loadStateSchema,
  longTimeoutOption,
  readOnlyAnnotations,
  waitStateSchema,
} from './schemas.js';
import { textContent } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Maximum length of text content to display before truncation */
const MAX_TEXT_DISPLAY_LENGTH = 1000;

// ============================================================================
// Schemas - Local schemas specific to page operations
// ============================================================================

const schemas = {
  // Common output schemas
  successResult: { success: z.boolean() },

  // Screenshot input/output
  screenshotInput: {
    ...basePageInput,
    fullPage: z
      .boolean()
      .default(false)
      .describe('Capture full scrollable page'),
    selector: z
      .string()
      .optional()
      .describe(
        'CSS selector to screenshot a specific element (overrides fullPage)'
      ),
    clip: clipRegionSchema
      .optional()
      .describe('Clip region to screenshot (overrides fullPage and selector)'),
    path: z
      .string()
      .optional()
      .describe('Optional file path to save screenshot'),
    type: imageFormatSchema.default('png').describe('Image format'),
    quality: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe('Quality for jpeg (0-100)'),
    omitBackground: z
      .boolean()
      .default(false)
      .describe(
        'Hide default white background for transparent screenshots (PNG only)'
      ),
  },
  screenshotOutput: {
    success: z.boolean(),
    path: z.string().optional(),
    base64: z.string().optional().describe('Base64-encoded image'),
  },

  // Wait for selector input/output
  waitSelectorInput: {
    ...basePageInput,
    selector: z.string().describe('CSS selector to wait for'),
    state: waitStateSchema
      .default('visible')
      .describe('Expected element state'),
    ...longTimeoutOption,
  },
  waitSelectorOutput: {
    success: z.boolean(),
    found: z.boolean(),
  },

  // Wait for load state input
  loadStateInput: {
    ...basePageInput,
    state: loadStateSchema
      .default('domcontentloaded')
      .describe(
        'Load state to wait for: load (all resources), domcontentloaded (DOM ready), networkidle (no network requests for 500ms)'
      ),
    ...longTimeoutOption,
  },

  // Accessibility scan input/output (with optional report generation)
  a11yScanInput: {
    ...basePageInput,
    tags: z
      .array(z.string())
      .optional()
      .describe(
        'WCAG tags to filter by (e.g., wcag2a, wcag2aa, wcag21aa, best-practice)'
      ),
    includedImpacts: z
      .array(a11yImpactSchema)
      .optional()
      .describe('Filter violations by impact level'),
    selector: z
      .string()
      .optional()
      .describe('CSS selector to limit the scan to a specific element'),
    generateReport: z
      .boolean()
      .default(false)
      .describe('Generate an HTML report file'),
    reportPath: z
      .string()
      .optional()
      .describe(
        'Path to save HTML report (only used if generateReport is true)'
      ),
  },
  a11yScanOutput: {
    success: z.boolean(),
    violations: z.array(
      z.object({
        id: z.string(),
        impact: z.string(),
        description: z.string(),
        help: z.string(),
        helpUrl: z.string(),
        nodes: z.array(
          z.object({
            html: z.string(),
            target: z.array(z.string()),
            failureSummary: z.string(),
          })
        ),
      })
    ),
    passes: z.number(),
    incomplete: z.number(),
    inapplicable: z.number(),
    reportPath: z.string().optional(),
  },

  // Accessibility snapshot input/output (LLM-friendly structured tree)
  snapshotInput: {
    ...basePageInput,
    interestingOnly: z
      .boolean()
      .default(true)
      .describe(
        'Only include interesting nodes (controls, links, headings, etc.)'
      ),
    root: z
      .string()
      .optional()
      .describe('CSS selector to limit snapshot to a specific element subtree'),
  },
  snapshotOutput: {
    success: z.boolean(),
    snapshot: z
      .string()
      .describe('YAML-like accessibility tree representation'),
    elementCount: z.number().describe('Number of elements in the tree'),
  },
} as const;

export function registerPageTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // ============================================================================
  // Screenshot & Content Tools
  // ============================================================================

  server.registerTool(
    'page_screenshot',
    {
      title: 'Take Page Screenshot',
      description:
        'Capture a screenshot of the page, a specific element, or a region. Returns base64-encoded image.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.screenshotInput,
      outputSchema: schemas.screenshotOutput,
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        fullPage,
        selector,
        clip,
        path,
        type,
        quality,
        omitBackground,
      }) => {
        const result = await browserManager.pageOperations.takeScreenshot({
          sessionId,
          pageId,
          fullPage,
          selector,
          clip,
          path,
          type,
          quality,
          omitBackground,
        });

        // Build description
        let description = 'Screenshot captured';
        if (selector) {
          description = `Element screenshot captured: ${selector}`;
        } else if (clip) {
          description = `Region screenshot captured (${clip.width}x${clip.height} at ${clip.x},${clip.y})`;
        } else if (fullPage) {
          description = 'Full page screenshot captured';
        }
        if (path) {
          description = `${description}, saved to ${path}`;
        }

        // Return as image content when data is available
        if (result.base64) {
          return {
            content: [
              {
                type: 'image' as const,
                data: result.base64,
                mimeType: type === 'jpeg' ? 'image/jpeg' : 'image/png',
              },
            ],
            structuredContent: { success: true, path: result.path },
          };
        }

        return {
          content: [textContent(description)],
          structuredContent: { success: true, path: result.path },
        };
      },
      'Error taking screenshot'
    )
  );

  server.registerTool(
    'page_content',
    {
      title: 'Get Page Content',
      description: 'Retrieve the HTML and text content of the page',
      annotations: readOnlyAnnotations,
      inputSchema: basePageInput,
      outputSchema: {
        success: z.boolean(),
        html: z.string(),
        text: z.string(),
      },
    },
    createToolHandler(async ({ sessionId, pageId }) => {
      const result = await browserManager.pageOperations.getPageContent(
        sessionId,
        pageId
      );

      // Truncate text for display
      const displayText =
        result.text.length > MAX_TEXT_DISPLAY_LENGTH
          ? `${result.text.substring(0, MAX_TEXT_DISPLAY_LENGTH)}... (truncated)`
          : result.text;

      return {
        content: [textContent(displayText)],
        structuredContent: { success: true, ...result },
      };
    }, 'Error getting page content')
  );

  server.registerTool(
    'page_evaluate',
    {
      title: 'Evaluate JavaScript',
      description:
        'Execute JavaScript in the page context. RESTRICTED: Only allows safe, read-only operations (DOM inspection, property retrieval).',
      annotations: interactionAnnotations,
      inputSchema: {
        ...basePageInput,
        script: z.string().describe('JavaScript code to execute'),
      },
      outputSchema: { result: z.unknown() },
    },
    createToolHandler(async ({ sessionId, pageId, script }) => {
      const result = await browserManager.pageOperations.evaluateScript(
        sessionId,
        pageId,
        script
      );

      return {
        content: [textContent('Script executed successfully')],
        structuredContent: result,
      };
    }, 'Error evaluating script')
  );

  // ============================================================================
  // Wait Tools
  // ============================================================================

  server.registerTool(
    'wait_for_selector',
    {
      title: 'Wait for Selector',
      description:
        'Wait for an element matching the selector to appear or reach a specific state',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.waitSelectorInput,
      outputSchema: schemas.waitSelectorOutput,
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, state, timeout }) => {
        const result = await browserManager.pageOperations.waitForSelector(
          sessionId,
          pageId,
          selector,
          { state, timeout }
        );

        return {
          content: [
            textContent(
              result.found
                ? `Element "${selector}" is ${state}`
                : `Element "${selector}" not found`
            ),
          ],
          structuredContent: { success: result.found, found: result.found },
        };
      },
      'Error waiting for selector'
    )
  );

  server.registerTool(
    'wait_for_download',
    {
      title: 'Wait for Download',
      description:
        'Wait for a file download to complete after triggering an action',
      annotations: readOnlyAnnotations,
      inputSchema: { ...basePageInput, ...longTimeoutOption },
      outputSchema: {
        success: z.boolean(),
        suggestedFilename: z.string().optional(),
        path: z.string().nullable().optional(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, timeout }) => {
      const result = await browserManager.pageOperations.waitForDownload(
        sessionId,
        pageId,
        { timeout }
      );

      return {
        content: [
          textContent(`Download complete: ${result.suggestedFilename}`),
        ],
        structuredContent: result,
      };
    }, 'Error waiting for download')
  );

  server.registerTool(
    'page_wait_for_load_state',
    {
      title: 'Wait for Load State',
      description:
        'Wait for the page to reach a specific load state. Recommended: use domcontentloaded for SPAs, networkidle for pages with async data loading.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.loadStateInput,
      outputSchema: schemas.successResult,
    },
    createToolHandler(async ({ sessionId, pageId, state, timeout }) => {
      const page = browserManager.getPageForTool(sessionId, pageId);
      await page.waitForLoadState(state, { timeout });
      browserManager.markSessionActive(sessionId);
      return {
        content: [textContent(`Page reached ${state} state`)],
        structuredContent: { success: true },
      };
    }, 'Error waiting for load state')
  );

  // ============================================================================
  // Accessibility Tools
  // ============================================================================

  server.registerTool(
    'accessibility_scan',
    {
      title: 'Run Accessibility Scan',
      description:
        'Scan the page for accessibility violations using axe-core. Returns WCAG violations with remediation guidance. Optionally generates an HTML report.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.a11yScanInput,
      outputSchema: schemas.a11yScanOutput,
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        tags,
        includedImpacts,
        selector,
        generateReport,
        reportPath,
      }) => {
        const result = await browserManager.pageOperations.runAccessibilityScan(
          sessionId,
          pageId,
          { tags, includedImpacts, selector }
        );

        let savedReportPath: string | undefined;

        // Generate HTML report if requested
        if (generateReport) {
          savedReportPath = reportPath || `logs/a11y-report-${Date.now()}.html`;
          const htmlReport = generateA11yHtmlReport(result);
          const { promises: fs } = await import('fs');
          const path = await import('path');
          await fs.mkdir(path.dirname(savedReportPath), { recursive: true });
          await fs.writeFile(savedReportPath, htmlReport);
        }

        const summary =
          result.violations.length === 0
            ? '✓ No accessibility violations found'
            : `✗ Found ${result.violations.length} accessibility violation(s)`;

        const reportInfo = savedReportPath
          ? ` Report saved to ${savedReportPath}`
          : '';

        return {
          content: [
            textContent(
              `${summary} (${result.passes} passed, ${result.incomplete} incomplete, ${result.inapplicable} inapplicable)${reportInfo}`
            ),
          ],
          structuredContent: { ...result, reportPath: savedReportPath },
        };
      },
      'Error running accessibility scan'
    )
  );

  // ============================================================================
  // Accessibility Snapshot Tool (LLM-optimized)
  // ============================================================================

  server.registerTool(
    'browser_snapshot',
    {
      title: 'Get Accessibility Snapshot',
      description: `Get a structured accessibility tree snapshot of the page. Returns a hierarchical tree of accessible elements with their roles, names, and states.

This is optimized for LLM consumption as it provides semantic structure rather than raw HTML. Use this to understand page structure before interactions.

Key features:
- Returns elements with ARIA roles (button, link, textbox, etc.)
- Includes accessible names, values, and states
- Shows hierarchy with parent-child relationships
- Filters to "interesting" elements by default (controls, headings, links)

Use interestingOnly=false for complete tree, or root selector to focus on a specific region.`,
      annotations: readOnlyAnnotations,
      inputSchema: schemas.snapshotInput,
      outputSchema: schemas.snapshotOutput,
    },
    createToolHandler(async ({ sessionId, pageId, interestingOnly, root }) => {
      const result =
        await browserManager.pageOperations.getAccessibilitySnapshot(
          sessionId,
          pageId,
          { interestingOnly, root }
        );

      // The snapshot is now a YAML-like string from ariaSnapshot()
      // which is already human-readable and LLM-friendly
      const displayText =
        result.snapshot || 'Empty page or no accessible elements';

      return {
        content: [
          textContent(
            `Accessibility snapshot (${result.elementCount} elements):\n${displayText}`
          ),
        ],
        structuredContent: result,
      };
    }, 'Error getting accessibility snapshot')
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

interface A11yReportViolation {
  id: string;
  impact?: string | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary?: string;
  }>;
}

function generateA11yHtmlReport(result: {
  violations: A11yReportViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
}): string {
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; line-height: 1.6; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
    .summary { background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
    .summary-item { text-align: center; }
    .summary-value { font-size: 2em; font-weight: bold; color: #1a1a1a; }
    .summary-label { font-size: 0.9em; color: #666; }
    .violation { border: 1px solid #e0e0e0; padding: 20px; margin: 16px 0; border-radius: 12px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .critical { border-left: 5px solid #d32f2f; }
    .serious { border-left: 5px solid #f57c00; }
    .moderate { border-left: 5px solid #fbc02d; }
    .minor { border-left: 5px solid #388e3c; }
    .violation h2 { margin-top: 0; display: flex; align-items: center; gap: 10px; }
    .impact-badge { font-size: 0.7em; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 600; }
    .impact-critical { background: #ffebee; color: #c62828; }
    .impact-serious { background: #fff3e0; color: #e65100; }
    .impact-moderate { background: #fffde7; color: #f9a825; }
    .impact-minor { background: #e8f5e9; color: #2e7d32; }
    .node { background: #f9f9f9; padding: 12px; margin: 8px 0; border-radius: 8px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.85em; overflow-x: auto; }
    a { color: #1976d2; }
    .no-violations { text-align: center; padding: 40px; background: #e8f5e9; border-radius: 12px; color: #2e7d32; }
    .no-violations svg { width: 48px; height: 48px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>🔍 Accessibility Report</h1>
  <div class="summary">
    <div class="summary-item"><div class="summary-value">${result.violations.length}</div><div class="summary-label">Violations</div></div>
    <div class="summary-item"><div class="summary-value">${result.passes}</div><div class="summary-label">Passed</div></div>
    <div class="summary-item"><div class="summary-value">${result.incomplete}</div><div class="summary-label">Incomplete</div></div>
    <div class="summary-item"><div class="summary-value">${result.inapplicable}</div><div class="summary-label">Inapplicable</div></div>
  </div>
  <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
  ${
    result.violations.length === 0
      ? `<div class="no-violations">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <h2>No accessibility violations found!</h2>
        <p>Great job! Your page passes all accessibility checks.</p>
      </div>`
      : result.violations
          .map(
            (v: A11yReportViolation) => `
  <div class="violation ${v.impact || 'minor'}">
    <h2>${v.id} <span class="impact-badge impact-${v.impact || 'minor'}">${v.impact || 'minor'}</span></h2>
    <p>${v.description}</p>
    <p><strong>How to fix:</strong> ${v.help}</p>
    <p><a href="${v.helpUrl}" target="_blank" rel="noopener noreferrer">Learn more →</a></p>
    <h3>Affected Elements (${v.nodes.length})</h3>
    ${v.nodes
      .slice(0, 10)
      .map(
        (n) => `
      <div class="node">
        <code>${escapeHtml(n.html.slice(0, 300))}${n.html.length > 300 ? '...' : ''}</code>
        <p style="margin: 8px 0 0; color: #666;">${n.failureSummary || ''}</p>
      </div>`
      )
      .join('')}
    ${v.nodes.length > 10 ? `<p><em>...and ${v.nodes.length - 10} more elements</em></p>` : ''}
  </div>`
          )
          .join('')
  }
</body>
</html>`;
}
