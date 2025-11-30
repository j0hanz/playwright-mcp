/**
 * Dialog Manager - Manages Playwright dialogs (alerts, confirms, prompts)
 */
import { Dialog, Page } from 'playwright';
import { Logger } from '../utils/logger.js';

export class DialogManager {
  private readonly pendingDialogs = new Map<string, Dialog>();
  private readonly dialogTimeouts = new Map<string, NodeJS.Timeout>();
  private static readonly DIALOG_AUTO_DISMISS_TIMEOUT = 10000;

  constructor(private readonly logger: Logger) {}

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

  cleanupPage(sessionId: string, pageId: string): void {
    const dialogKey = `${sessionId}:${pageId}`;
    const timeoutId = this.dialogTimeouts.get(dialogKey);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.dialogTimeouts.delete(dialogKey);
    }
    this.pendingDialogs.delete(dialogKey);
  }

  cleanupSession(sessionId: string, pageIds: string[]): void {
    for (const pageId of pageIds) {
      this.cleanupPage(sessionId, pageId);
    }
  }

  getPendingDialog(sessionId: string, pageId: string): Dialog | undefined {
    return this.pendingDialogs.get(`${sessionId}:${pageId}`);
  }

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
