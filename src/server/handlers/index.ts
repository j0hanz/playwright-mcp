import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { BrowserManager } from '../../playwright/browser-manager.js';
import { Logger } from '../../utils/logger.js';

/**
 * Handler Index - Re-exports all tool handlers
 *
 * This module provides a central registration function that
 * registers all tool handlers with the MCP server.
 */
export { registerBrowserTools } from './browser-tools.js';
export { registerNavigationTools } from './navigation-tools.js';
export { registerInteractionTools } from './interaction-tools.js';

export {
  toolErrorResponse,
  createToolHandlerFactory,
  successResponse,
  imageResponse,
  type ToolContext,
  type ToolResponse,
  type ErrorResponse,
  type ToolRegistrationFn,
} from './types.js';

/**
 * Register all modular tool handlers with the MCP server.
 *
 * Note: Tools are currently registered inline in mcp-server.ts using createToolHandler.
 * This function provides extension point for additional modular handlers.
 */
export function registerAllHandlers(
  _server: McpServer,
  _browserManager: BrowserManager,
  logger: Logger
): void {
  logger.info('Modular handlers initialized', {
    availableGroups: ['browser', 'navigation', 'interaction'],
  });
}
