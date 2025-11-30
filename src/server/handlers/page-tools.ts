/**
 * Page Tool Handlers
 *
 * Tools for page inspection, screenshots, and waiting:
 * - page_screenshot: Capture page screenshot
 * - page_content: Get page HTML/text content
 * - wait_for_selector: Wait for element to appear
 * - wait_for_download: Wait for file download
 * - page_wait_for_load_state: Wait for page load state
 * - wait_for_network_idle: Wait for network idle
 * - page_evaluate: Execute JavaScript
 * - accessibility_scan: Run axe-core accessibility scan
 * - accessibility_report: Generate HTML accessibility report
 * - emulate_reduced_motion: Emulate reduced motion preference
 * - emulate_color_scheme: Emulate color scheme preference
 */
import { z } from 'zod';

import {
  basePageInput,
  longTimeoutOption,
  textContent,
  type ToolContext,
} from './types.js';

export function registerPageTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // Page Screenshot Tool
  server.registerTool(
    'page_screenshot',
    {
      title: 'Take Page Screenshot',
      description:
        'Capture a screenshot of the page. Returns base64-encoded PNG.',
      inputSchema: {
        ...basePageInput,
        fullPage: z
          .boolean()
          .default(false)
          .describe('Capture full scrollable page'),
        path: z
          .string()
          .optional()
          .describe('Optional file path to save screenshot'),
        type: z.enum(['png', 'jpeg']).default('png').describe('Image format'),
        quality: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe('Quality for jpeg (0-100)'),
      },
      outputSchema: {
        success: z.boolean(),
        path: z.string().optional(),
        base64: z.string().optional().describe('Base64-encoded image'),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, fullPage, path, type, quality }) => {
        const result = await browserManager.takeScreenshot({
          sessionId,
          pageId,
          fullPage,
          path,
          type,
          quality,
        });

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
          content: [
            textContent(
              path ? `Screenshot saved to ${path}` : 'Screenshot captured'
            ),
          ],
          structuredContent: { success: true, path: result.path },
        };
      },
      'Error taking screenshot'
    )
  );

  // Page Content Tool
  server.registerTool(
    'page_content',
    {
      title: 'Get Page Content',
      description: 'Retrieve the HTML and text content of the page',
      inputSchema: {
        ...basePageInput,
      },
      outputSchema: {
        success: z.boolean(),
        html: z.string(),
        text: z.string(),
      },
    },
    createToolHandler(async ({ sessionId, pageId }) => {
      const result = await browserManager.getPageContent(sessionId, pageId);

      // Truncate text for display
      const displayText =
        result.text.length > 1000
          ? `${result.text.substring(0, 1000)}... (truncated)`
          : result.text;

      return {
        content: [textContent(displayText)],
        structuredContent: { success: true, ...result },
      };
    }, 'Error getting page content')
  );

  // Wait for Selector Tool
  server.registerTool(
    'wait_for_selector',
    {
      title: 'Wait for Selector',
      description:
        'Wait for an element matching the selector to appear or reach a specific state',
      inputSchema: {
        ...basePageInput,
        selector: z.string().describe('CSS selector to wait for'),
        state: z
          .enum(['attached', 'detached', 'visible', 'hidden'])
          .default('visible')
          .describe('Expected element state'),
        ...longTimeoutOption,
      },
      outputSchema: {
        success: z.boolean(),
        found: z.boolean(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, state, timeout }) => {
        const result = await browserManager.waitForSelector(
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

  // Wait for Download Tool
  server.registerTool(
    'wait_for_download',
    {
      title: 'Wait for Download',
      description:
        'Wait for a file download to complete after triggering an action',
      inputSchema: {
        ...basePageInput,
        ...longTimeoutOption,
      },
      outputSchema: {
        success: z.boolean(),
        suggestedFilename: z.string().optional(),
        path: z.string().nullable().optional(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, timeout }) => {
      const result = await browserManager.waitForDownload(sessionId, pageId, {
        timeout,
      });

      return {
        content: [
          textContent(`Download complete: ${result.suggestedFilename}`),
        ],
        structuredContent: result,
      };
    }, 'Error waiting for download')
  );

  // Wait for Load State Tool
  server.registerTool(
    'page_wait_for_load_state',
    {
      title: 'Wait for Load State',
      description:
        'Wait for the page to reach a specific load state. Recommended: use domcontentloaded for SPAs, networkidle for pages with async data loading.',
      inputSchema: {
        ...basePageInput,
        state: z
          .enum(['load', 'domcontentloaded', 'networkidle'])
          .default('domcontentloaded')
          .describe(
            'Load state to wait for: load (all resources), domcontentloaded (DOM ready), networkidle (no network requests for 500ms)'
          ),
        ...longTimeoutOption,
      },
      outputSchema: {
        success: z.boolean(),
      },
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

  // Wait for Network Idle Tool
  server.registerTool(
    'wait_for_network_idle',
    {
      title: 'Wait for Network Idle',
      description:
        'Wait until there are no network connections for at least 500ms. Useful for pages with async data loading.',
      inputSchema: {
        ...basePageInput,
        ...longTimeoutOption,
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, timeout }) => {
      const page = browserManager.getPageForTool(sessionId, pageId);
      await page.waitForLoadState('networkidle', { timeout });
      browserManager.markSessionActive(sessionId);
      return {
        content: [textContent('Page reached network idle state')],
        structuredContent: { success: true },
      };
    }, 'Error waiting for network idle')
  );

  // Page Evaluate Tool
  server.registerTool(
    'page_evaluate',
    {
      title: 'Evaluate JavaScript',
      description:
        'Execute JavaScript in the page context. RESTRICTED: Only allows safe, read-only operations (DOM inspection, property retrieval).',
      inputSchema: {
        ...basePageInput,
        script: z.string().describe('JavaScript code to execute'),
      },
      outputSchema: {
        result: z.unknown(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, script }) => {
      const result = await browserManager.evaluateScript(
        sessionId,
        pageId,
        script
      );

      return {
        content: [textContent(`Script executed successfully`)],
        structuredContent: result,
      };
    }, 'Error evaluating script')
  );

  // Accessibility Scan Tool
  server.registerTool(
    'accessibility_scan',
    {
      title: 'Run Accessibility Scan',
      description:
        'Scan the page for accessibility violations using axe-core. Returns WCAG violations with remediation guidance.',
      inputSchema: {
        ...basePageInput,
        tags: z
          .array(z.string())
          .optional()
          .describe(
            'WCAG tags to filter by (e.g., wcag2a, wcag2aa, wcag21aa, best-practice)'
          ),
        includedImpacts: z
          .array(z.enum(['minor', 'moderate', 'serious', 'critical']))
          .optional()
          .describe('Filter violations by impact level'),
        selector: z
          .string()
          .optional()
          .describe('CSS selector to limit the scan to a specific element'),
      },
      outputSchema: {
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
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, tags, includedImpacts, selector }) => {
        const result = await browserManager.runAccessibilityScan(
          sessionId,
          pageId,
          { tags, includedImpacts, selector }
        );

        const summary =
          result.violations.length === 0
            ? '✓ No accessibility violations found'
            : `✗ Found ${result.violations.length} accessibility violation(s)`;

        return {
          content: [
            textContent(
              `${summary} (${result.passes} passed, ${result.incomplete} incomplete, ${result.inapplicable} inapplicable)`
            ),
          ],
          structuredContent: result,
        };
      },
      'Error running accessibility scan'
    )
  );

  // Emulate Reduced Motion Tool
  server.registerTool(
    'emulate_reduced_motion',
    {
      title: 'Emulate Reduced Motion',
      description:
        'Emulate reduced motion preference for accessibility testing. Important for users with vestibular disorders.',
      inputSchema: {
        ...basePageInput,
        reducedMotion: z
          .enum(['reduce', 'no-preference'])
          .describe('Reduced motion preference'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, reducedMotion }) => {
      const page = browserManager.getPageForTool(sessionId, pageId);
      await page.emulateMedia({ reducedMotion });
      browserManager.markSessionActive(sessionId);
      return {
        content: [textContent(`Reduced motion set to: ${reducedMotion}`)],
        structuredContent: { success: true },
      };
    }, 'Error emulating reduced motion')
  );

  // Emulate Color Scheme Tool
  server.registerTool(
    'emulate_color_scheme',
    {
      title: 'Emulate Color Scheme',
      description: 'Emulate light or dark color scheme for theme testing',
      inputSchema: {
        ...basePageInput,
        colorScheme: z
          .enum(['light', 'dark', 'no-preference'])
          .describe('Color scheme preference'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, colorScheme }) => {
      const page = browserManager.getPageForTool(sessionId, pageId);
      await page.emulateMedia({ colorScheme });
      browserManager.markSessionActive(sessionId);
      return {
        content: [textContent(`Color scheme set to: ${colorScheme}`)],
        structuredContent: { success: true },
      };
    }, 'Error emulating color scheme')
  );

  // Generate Accessibility HTML Report Tool
  server.registerTool(
    'accessibility_report',
    {
      title: 'Generate Accessibility HTML Report',
      description:
        'Run accessibility scan and generate an HTML report file for audit purposes',
      inputSchema: {
        ...basePageInput,
        outputPath: z
          .string()
          .optional()
          .describe(
            'Path to save HTML report (defaults to logs/a11y-report-{timestamp}.html)'
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe('WCAG tags to filter by (e.g., wcag2a, wcag2aa)'),
      },
      outputSchema: {
        success: z.boolean(),
        reportPath: z.string(),
        violationsCount: z.number(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, outputPath, tags }) => {
      const result = await browserManager.runAccessibilityScan(
        sessionId,
        pageId,
        { tags }
      );

      const reportPath = outputPath || `logs/a11y-report-${Date.now()}.html`;

      // Generate HTML report
      const htmlReport = `<!DOCTYPE html>
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
    <div class="summary-item">
      <div class="summary-value">${result.violations.length}</div>
      <div class="summary-label">Violations</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${result.passes}</div>
      <div class="summary-label">Passed</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${result.incomplete}</div>
      <div class="summary-label">Incomplete</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${result.inapplicable}</div>
      <div class="summary-label">Inapplicable</div>
    </div>
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
            (v) => `
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
        <code>${n.html.slice(0, 300).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}${n.html.length > 300 ? '...' : ''}</code>
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

      const { promises: fs } = await import('fs');
      const path = await import('path');
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, htmlReport);

      return {
        content: [
          textContent(
            `Accessibility report generated: ${result.violations.length} violations found. Report saved to ${reportPath}`
          ),
        ],
        structuredContent: {
          success: true,
          reportPath,
          violationsCount: result.violations.length,
        },
      };
    }, 'Error generating accessibility report')
  );
}
