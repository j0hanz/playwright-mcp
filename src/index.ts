import { MCPPlaywrightServer } from './server/mcp-server.js';
import { toError } from './utils/error-handler.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('Main');

async function main(): Promise<void> {
  let server: MCPPlaywrightServer | null = null;

  try {
    logger.info('Starting MCP Playwright Server...');

    server = new MCPPlaywrightServer();
    await server.start();

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      if (server) {
        await server.cleanup();
      }
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      if (server) {
        void server.cleanup().finally(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason: String(reason) });
    });
  } catch (error) {
    const err = toError(error);
    logger.error('Failed to start server', { error: err.message });
    if (server) {
      await server.cleanup();
    }
    process.exit(1);
  }
}

void main();
