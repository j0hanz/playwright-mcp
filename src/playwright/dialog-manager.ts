/**
 * Dialog Manager - Manages Playwright dialogs (alerts, confirms, prompts)
 */
import { Dialog, Page } from 'playwright';
import { Logger } from '../utils/logger.js';

const DIALOG_AUTO_DISMISS_TIMEOUT_MS = 10_000;

export class DialogManager {
  private readonly pendingDialogs = new Map<string, Dialog>();
  private readonly dialogTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(private readonly logger: Logger) {}

  private createDialogKey(sessionId: string, pageId: string): string {
    return `${sessionId}:${pageId}`;
  }

  setupDialogHandler(sessionId: string, pageId: string, page: Page): void {
    const dialogKey = this.createDialogKey(sessionId, pageId);

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
            timeoutMs: DIALOG_AUTO_DISMISS_TIMEOUT_MS,
          });
        }
      }, DIALOG_AUTO_DISMISS_TIMEOUT_MS);
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
    const dialogKey = this.createDialogKey(sessionId, pageId);
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
    return this.pendingDialogs.get(this.createDialogKey(sessionId, pageId));
  }

  async handleDialog(
    sessionId: string,
    pageId: string,
    accept: boolean,
    promptText?: string
  ): Promise<{ dialogType: string; message: string }> {
    const dialogKey = this.createDialogKey(sessionId, pageId);
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
