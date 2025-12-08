/**
 * Accessibility Report Generator - Generates HTML reports from axe-core results
 */

export interface A11yViolationNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

export interface A11yViolation {
  id: string;
  impact?: string | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: A11yViolationNode[];
}

export interface A11yReportResult {
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
}

/**
 * Escape HTML special characters to prevent XSS in generated reports.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate an HTML accessibility report from axe-core scan results.
 *
 * @param result - The accessibility scan results
 * @returns HTML string containing the formatted report
 *
 * @example
 * ```typescript
 * const html = generateA11yHtmlReport(scanResults);
 * await fs.writeFile('a11y-report.html', html);
 * ```
 */
export function generateA11yHtmlReport(result: A11yReportResult): string {
  const timestamp = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report</title>
  <style>
    ${getReportStyles()}
  </style>
</head>
<body>
  <h1>🔍 Accessibility Report</h1>
  ${generateSummarySection(result)}
  <p><strong>Generated:</strong> ${timestamp}</p>
  ${generateViolationsSection(result.violations)}
</body>
</html>`;
}

function getReportStyles(): string {
  return `
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
  `;
}

function generateSummarySection(result: A11yReportResult): string {
  return `
  <div class="summary">
    <div class="summary-item"><div class="summary-value">${result.violations.length}</div><div class="summary-label">Violations</div></div>
    <div class="summary-item"><div class="summary-value">${result.passes}</div><div class="summary-label">Passed</div></div>
    <div class="summary-item"><div class="summary-value">${result.incomplete}</div><div class="summary-label">Incomplete</div></div>
    <div class="summary-item"><div class="summary-value">${result.inapplicable}</div><div class="summary-label">Inapplicable</div></div>
  </div>`;
}

function generateViolationsSection(violations: A11yViolation[]): string {
  if (violations.length === 0) {
    return `
      <div class="no-violations">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <h2>No accessibility violations found!</h2>
        <p>Great job! Your page passes all accessibility checks.</p>
      </div>`;
  }

  return violations.map(generateViolationCard).join('');
}

function generateViolationCard(violation: A11yViolation): string {
  const impact = violation.impact || 'minor';
  const maxNodesToShow = 10;
  const truncatedNodes = violation.nodes.slice(0, maxNodesToShow);
  const remainingCount = violation.nodes.length - maxNodesToShow;

  return `
  <div class="violation ${impact}">
    <h2>${escapeHtml(violation.id)} <span class="impact-badge impact-${impact}">${impact}</span></h2>
    <p>${escapeHtml(violation.description)}</p>
    <p><strong>How to fix:</strong> ${escapeHtml(violation.help)}</p>
    <p><a href="${escapeHtml(violation.helpUrl)}" target="_blank" rel="noopener noreferrer">Learn more →</a></p>
    <h3>Affected Elements (${violation.nodes.length})</h3>
    ${truncatedNodes.map(generateNodeCard).join('')}
    ${remainingCount > 0 ? `<p><em>...and ${remainingCount} more elements</em></p>` : ''}
  </div>`;
}

function generateNodeCard(node: A11yViolationNode): string {
  const maxHtmlLength = 300;
  const truncatedHtml =
    node.html.length > maxHtmlLength
      ? `${node.html.slice(0, maxHtmlLength)}...`
      : node.html;

  return `
      <div class="node">
        <code>${escapeHtml(truncatedHtml)}</code>
        ${node.failureSummary ? `<p style="margin: 8px 0 0; color: #666;">${escapeHtml(node.failureSummary)}</p>` : ''}
      </div>`;
}
