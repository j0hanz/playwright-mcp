import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { BrowserManager } from '../../playwright/browser-manager.js';
import { Logger } from '../../utils/logger.js';
import { registerAssertionTools } from './assertion-tools.js';
import { registerBrowserTools } from './browser-tools.js';
import { registerInteractionTools } from './interaction-tools.js';
import { registerLocatorTools } from './locator-tools.js';
import { registerNavigationTools } from './navigation-tools.js';
import { registerPageTools } from './page-tools.js';
import { registerTestTools } from './test-tools.js';
import { createToolHandlerFactory, type ToolContext } from './types.js';

/**
 * Handler Index - Central registration for all modular tool handlers
 *
 * This module provides the main registration function that wires up
 * all categorized tool handlers with the MCP server.
 *
 * Tool Categories:
 * - Assertion Tools: Web-first assertions (assert_visible, assert_text, etc.)
 * - Locator Tools: Semantic locators (click_by_role, fill_by_label, etc.)
 * - Page Tools: Page operations (screenshot, content, wait tools)
 * - Browser Tools: Session management (launch, close, navigate)
 * - Navigation Tools: URL navigation and history
 * - Interaction Tools: Element interactions (click, fill, hover)
 * - Test Tools: Test planning and generation
 */

// Re-export existing handlers for backward compatibility
export { registerBrowserTools } from './browser-tools.js';
export { registerInteractionTools } from './interaction-tools.js';
export { registerNavigationTools } from './navigation-tools.js';

// Re-export new modular handlers
export { registerAssertionTools } from './assertion-tools.js';
export { registerLocatorTools } from './locator-tools.js';
export { registerPageTools } from './page-tools.js';
export { registerTestTools } from './test-tools.js';

// Re-export types and utilities
export {
  // Shared Zod schemas for DRY tool definitions
  baseLocatorInput,
  basePageInput,
  exactMatchOption,
  forceOption,
  longTimeoutOption,
  selectorInput,
  selectorWithTimeout,
  timeoutOption,
  // Response builders and utilities
  createToolHandlerFactory,
  imageResponse,
  successResponse,
  textContent,
  toolErrorResponse,
  type ErrorResponse,
  type ToolContext,
  type ToolRegistrationFn,
  type ToolResponse,
} from './types.js';

/**
 * Register all modular tool handlers with the MCP server.
 *
 * This function creates the shared ToolContext and registers all
 * categorized tool handlers. Call this from mcp-server.ts instead
 * of inline tool definitions.
 *
 * @param server - MCP server instance
 * @param browserManager - Browser manager for Playwright operations
 * @param logger - Logger instance for diagnostics
 */
export function registerAllHandlers(
  server: McpServer,
  browserManager: BrowserManager,
  logger: Logger
): void {
  // Create shared tool context
  const createToolHandler = createToolHandlerFactory(logger);

  const ctx: ToolContext = {
    server,
    browserManager,
    logger,
    createToolHandler,
  };

  // Register all tool categories
  const registrations = [
    { name: 'browser', register: registerBrowserTools },
    { name: 'navigation', register: registerNavigationTools },
    { name: 'interaction', register: registerInteractionTools },
    { name: 'assertion', register: registerAssertionTools },
    { name: 'locator', register: registerLocatorTools },
    { name: 'page', register: registerPageTools },
    { name: 'test', register: registerTestTools },
  ];

  for (const { name, register } of registrations) {
    try {
      register(ctx);
      logger.debug(`Registered ${name} tools`);
    } catch (error) {
      logger.error(`Failed to register ${name} tools`, { error });
      throw error;
    }
  }

  logger.info('All modular handlers registered', {
    categories: registrations.map((r) => r.name),
  });
}
