import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import config from '../config/server-config.js';
import { BrowserManager } from '../playwright/browser-manager.js';
import { toError } from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';
import { registerAllHandlers } from './handlers/index.js';

const bytesToMB = (bytes: number): string =>
  `${Math.round(bytes / 1024 / 1024)}MB`;

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
  private static readonly MAX_CLEANUP_FAILURES = 5;

  constructor() {
    this.server = new McpServer({
      name: 'mcp-playwright-server',
      version: '1.0.0',
    });

    this.browserManager = new BrowserManager();
    this.logger = new Logger('MCPPlaywrightServer');

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
          'Cleanup failing repeatedly. Keeping interval active but please investigate.',
          { failures: this.cleanupFailures }
        );
        this.cleanupFailures = 0;
      }
    }
  }

  private startSessionCleanup(): void {
    // Run session cleanup at configured interval
    this.cleanupInterval = setInterval(() => {
      void this.performSessionCleanup();
    }, config.cleanupInterval);
  }

  private async closeSessionSafe(sessionId: string): Promise<boolean> {
    try {
      await this.browserManager.closeBrowser(sessionId);
      this.logger.info('Closed browser session', { sessionId });
      return true;
    } catch (error) {
      const err = toError(error);
      this.logger.error('Failed to close session', {
        sessionId,
        error: err.message,
      });
      return false;
    }
  }

  async cleanup(): Promise<{ closedCount: number; failedCount: number }> {
    this.logger.info('Starting cleanup...');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const sessions = this.browserManager.listSessions();
    const results = await Promise.all(
      sessions.map((session) => this.closeSessionSafe(session.id))
    );

    const closedCount = results.filter(Boolean).length;
    const failedCount = results.length - closedCount;

    this.logger.info('Cleanup completed', { closedCount, failedCount });
    return { closedCount, failedCount };
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
                heapUsed: bytesToMB(memoryUsage.heapUsed),
                heapTotal: bytesToMB(memoryUsage.heapTotal),
                rss: bytesToMB(memoryUsage.rss),
                external: bytesToMB(memoryUsage.external),
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

    this.server.registerResource(
      'server-status',
      STATUS,
      {
        title: 'Server Status',
        description:
          'Current status of the MCP Playwright server with capacity information',
        mimeType: 'application/json',
      },
      () => this.handleServerStatus(STATUS)
    );

    this.server.registerResource(
      'health',
      HEALTH,
      {
        title: 'Health Check',
        description: 'Server health status with performance metrics',
        mimeType: 'application/json',
      },
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

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}
