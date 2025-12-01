import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import config from '../config/server-config.js';
import { BrowserManager } from '../playwright/browser-manager.js';
import { toError } from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';
import { formatUptime } from '../utils/time-utils.js';
import { registerAllHandlers } from './handlers/index.js';

export class MCPPlaywrightServer {
  // Resource URI constants
  private static readonly RESOURCE_URIS = {
    STATUS: 'playwright://status',
    HEALTH: 'playwright://health',
  } as const;

  private server: McpServer;
  protected browserManager: BrowserManager;
  private logger: Logger;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupFailures = 0;
  private readonly registeredTools = new Set<string>();
  private static readonly MAX_CLEANUP_FAILURES = 5;

  constructor() {
    this.server = new McpServer({
      name: 'mcp-playwright-server',
      version: '1.0.0',
    });

    this.browserManager = new BrowserManager();
    this.logger = new Logger('MCPPlaywrightServer');
    this.setupToolRegistrationGuard();

    this.registerTools();
    this.registerResources();
    this.startSessionCleanup();
  }

  private async performSessionCleanup(): Promise<void> {
    try {
      const { cleaned } = await this.browserManager.cleanupExpiredSessions(
        config.sessionTimeout
      );
      this.cleanupFailures = 0;
      if (cleaned > 0) {
        this.logger.info('Cleaned up expired sessions', { count: cleaned });
      }
    } catch (error: unknown) {
      this.cleanupFailures++;
      const err = toError(error);
      this.logger.error('Session cleanup failed', {
        error: err.message,
        stack: err.stack,
        failures: this.cleanupFailures,
      });

      // Stop cleanup interval if failing repeatedly
      if (this.cleanupFailures >= MCPPlaywrightServer.MAX_CLEANUP_FAILURES) {
        this.logger.error(
          'Cleanup failing repeatedly, stopping cleanup interval',
          { failures: this.cleanupFailures }
        );
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
          this.cleanupInterval = null;
        }
      }
    }
  }

  private startSessionCleanup(): void {
    // Run session cleanup at configured interval
    this.cleanupInterval = setInterval(() => {
      void this.performSessionCleanup();
    }, config.cleanupInterval);
  }

  private async closeSessionSafe(sessionId: string): Promise<void> {
    try {
      await this.browserManager.closeBrowser(sessionId);
      this.logger.info('Closed browser session', { sessionId });
    } catch (error) {
      const err = toError(error);
      this.logger.error('Failed to close session', {
        sessionId,
        error: err.message,
      });
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('Starting cleanup...');

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all browser sessions
    const sessions = this.browserManager.listSessions();
    await Promise.all(
      sessions.map((session) => this.closeSessionSafe(session.id))
    );

    this.logger.info('Cleanup completed');
  }

  private setupToolRegistrationGuard(): void {
    const originalRegisterTool = this.server.registerTool.bind(this.server);

    this.server.registerTool = ((name, definition, handler) => {
      if (this.registeredTools.has(name)) {
        this.logger.warn('Skipping duplicate tool registration', {
          tool: name,
        });
        return;
      }

      this.registeredTools.add(name);
      return originalRegisterTool(name, definition, handler);
    }) as typeof this.server.registerTool;
  }

  private registerTools(): void {
    registerAllHandlers(this.server, this.browserManager, this.logger);
  }

  private handleServerStatus(uri: string) {
    try {
      const status = this.browserManager.getServerStatus();

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'running',
              capacity: {
                activeSessions: status.activeSessions,
                maxSessions: status.maxSessions,
                availableSlots: status.availableSlots,
                utilizationPercent: Math.round(
                  (status.activeSessions / status.maxSessions) * 100
                ),
              },
              sessions: status.sessions,
              config: {
                defaultBrowser: config.defaultBrowser,
                headless: config.headless,
                sessionTimeout: config.sessionTimeout,
                cleanupInterval: config.cleanupInterval,
              },
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get server status', {
        error: toError(error).message,
      });
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'error',
              error: toError(error).message,
            }),
          },
        ],
      };
    }
  }

  private handleHealthCheck(uri: string) {
    try {
      const sessions = this.browserManager.listSessions();
      const memoryUsage = process.memoryUsage();

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'healthy',
              uptime: process.uptime(),
              uptimeFormatted: formatUptime(process.uptime()),
              memory: {
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
              },
              sessions: {
                active: sessions.length,
                max: config.maxConcurrentSessions,
                details: sessions.map((s) => ({
                  id: s.id,
                  browserType: s.browserType,
                  pageCount: s.pageCount,
                  idleSeconds: Math.round(
                    (Date.now() - s.lastActivity.getTime()) / 1000
                  ),
                })),
              },
              version: '1.0.0',
              nodeVersion: process.version,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get health status', {
        error: toError(error).message,
      });
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'unhealthy',
              error: toError(error).message,
            }),
          },
        ],
      };
    }
  }

  private registerResources(): void {
    const { STATUS, HEALTH } = MCPPlaywrightServer.RESOURCE_URIS;

    // Server status resource with capacity info
    this.server.registerResource(
      'server-status',
      STATUS,
      {
        title: 'Server Status',
        description:
          'Current status of the MCP Playwright server with capacity information',
        mimeType: 'application/json',
      },
      // sync implementation but SDK expects async callback
      () => this.handleServerStatus(STATUS)
    );

    // Health check resource with detailed metrics
    this.server.registerResource(
      'health',
      HEALTH,
      {
        title: 'Health Check',
        description: 'Server health status with performance metrics',
        mimeType: 'application/json',
      },
      // sync implementation but SDK expects async callback
      () => this.handleHealthCheck(HEALTH)
    );

    this.logger.info('Resources registered successfully');
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('MCP Playwright Server started successfully');
  }
}

export default MCPPlaywrightServer;
