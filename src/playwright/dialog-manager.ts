/**
 * Dialog Manager - Manages Playwright dialogs (alerts, confirms, prompts)
 */
import { Dialog, Page } from 'playwright';

import config from '../config/server-config.js';
import { ErrorCode, ErrorHandler } from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';

export class DialogManager {
  private readonly pendingDialogs = new Map<string, Dialog>();
  private readonly dialogTimeouts = new Map<string, NodeJS.Timeout>();
  public static readonly NO_PENDING_DIALOG_MSG =
    'No pending dialog found for this page';

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
          dialog.dismiss().catch((error: unknown) => {
            // Log dismissal errors instead of silently swallowing
            this.logger.warn('Failed to auto-dismiss dialog', {
              sessionId,
              pageId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
          this.pendingDialogs.delete(dialogKey);
          this.dialogTimeouts.delete(dialogKey);
          this.logger.warn('Dialog auto-dismissed due to timeout', {
            sessionId,
            pageId,
            timeoutMs: config.timeouts.dialogAutoDismiss,
          });
        }
      }, config.timeouts.dialogAutoDismiss);
      this.dialogTimeouts.set(dialogKey, timeoutId);
    });

    page.on('close', () => {
      this.cleanupPage(sessionId, pageId);
      this.logger.debug('Page closed, cleaned up dialogs', {
        sessionId,
        pageId,
      });
    });

    page.on('crash', () => {
      this.cleanupPage(sessionId, pageId);
      this.logger.warn('Page crashed, cleaned up dialogs', {
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
      throw ErrorHandler.createError(
        ErrorCode.DIALOG_ERROR,
        DialogManager.NO_PENDING_DIALOG_MSG
      );
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
