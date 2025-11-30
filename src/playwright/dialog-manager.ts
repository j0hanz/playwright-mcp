import { Dialog, Page } from 'playwright';
import { Logger } from '../utils/logger.js';

/**
 * Manages Playwright dialogs (alerts, confirms, prompts) for browser sessions.
 * Handles auto-dismissal of dialogs to prevent blocking execution.
 */
export class DialogManager {
  /** Pending dialogs awaiting user action, keyed by "sessionId:pageId" */
  private readonly pendingDialogs = new Map<string, Dialog>();

  /** Auto-dismiss timeouts for dialogs */
  private readonly dialogTimeouts = new Map<string, NodeJS.Timeout>();

  /** Auto-dismiss dialogs after 10 seconds (default action timeout * 2) */
  private static readonly DIALOG_AUTO_DISMISS_TIMEOUT = 10000;

  constructor(private readonly logger: Logger) {}

  /**
   * Sets up dialog handling for a page.
   * Listens for 'dialog' events and sets up auto-dismissal.
   */
  setupDialogHandler(sessionId: string, pageId: string, page: Page): void {
    const dialogKey = `${sessionId}:${pageId}`;

    page.on('dialog', (dialog) => {
      const existingTimeout = this.dialogTimeouts.get(dialogKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.dialogTimeouts.delete(dialogKey);
      }

      this.pendingDialogs.set(dialogKey, dialog);
      this.logger.info('Dialog detected', {
        sessionId,
        pageId,
        type: dialog.type(),
        message: dialog.message(),
      });

      const timeoutId = setTimeout(() => {
        if (this.pendingDialogs.has(dialogKey)) {
          dialog.dismiss().catch(() => {});
          this.pendingDialogs.delete(dialogKey);
          this.dialogTimeouts.delete(dialogKey);
          this.logger.warn('Dialog auto-dismissed due to timeout', {
            sessionId,
            pageId,
            timeoutMs: DialogManager.DIALOG_AUTO_DISMISS_TIMEOUT,
          });
        }
      }, DialogManager.DIALOG_AUTO_DISMISS_TIMEOUT);
      this.dialogTimeouts.set(dialogKey, timeoutId);
    });

    page.on('close', () => {
      this.cleanupPage(sessionId, pageId);
      this.logger.debug('Page closed, cleaned up dialogs', {
        sessionId,
        pageId,
      });
    });
  }

  /**
   * Cleans up dialogs for a specific page.
   */
  cleanupPage(sessionId: string, pageId: string): void {
    const dialogKey = `${sessionId}:${pageId}`;
    const timeoutId = this.dialogTimeouts.get(dialogKey);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.dialogTimeouts.delete(dialogKey);
    }
    this.pendingDialogs.delete(dialogKey);
  }

  /**
   * Cleans up dialogs for all pages in a session.
   */
  cleanupSession(sessionId: string, pageIds: string[]): void {
    for (const pageId of pageIds) {
      this.cleanupPage(sessionId, pageId);
    }
  }

  /**
   * Gets a pending dialog for a page if one exists.
   */
  getPendingDialog(sessionId: string, pageId: string): Dialog | undefined {
    return this.pendingDialogs.get(`${sessionId}:${pageId}`);
  }

  /**
   * Handles a pending dialog.
   */
  async handleDialog(
    sessionId: string,
    pageId: string,
    accept: boolean,
    promptText?: string
  ): Promise<{ dialogType: string; message: string }> {
    const dialogKey = `${sessionId}:${pageId}`;
    const dialog = this.pendingDialogs.get(dialogKey);

    if (!dialog) {
      throw new Error('No pending dialog found for this page');
    }

    const dialogType = dialog.type();
    const message = dialog.message();

    if (accept) {
      await dialog.accept(promptText);
    } else {
      await dialog.dismiss();
    }

    this.cleanupPage(sessionId, pageId);

    return { dialogType, message };
  }
}
