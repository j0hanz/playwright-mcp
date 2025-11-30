import { Logger } from '../../utils/logger.js';
import { SessionManager } from '../session-manager.js';

export class NetworkActions {
  constructor(
    private sessionManager: SessionManager,
    private logger: Logger
  ) {}

  async routeFromHAR(
    sessionId: string,
    pageId: string,
    harPath: string,
    options: {
      url?: string | RegExp;
      notFound?: 'abort' | 'fallback';
      update?: boolean;
      updateContent?: 'embed' | 'attach';
      updateMode?: 'full' | 'minimal';
    } = {}
  ): Promise<{ success: boolean; harPath: string }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    await page.routeFromHAR(harPath, options);
    this.sessionManager.updateActivity(sessionId);
    return { success: true, harPath };
  }

  async contextRouteFromHAR(
    sessionId: string,
    harPath: string,
    options: {
      url?: string | RegExp;
      notFound?: 'abort' | 'fallback';
      update?: boolean;
      updateContent?: 'embed' | 'attach';
      updateMode?: 'full' | 'minimal';
    } = {}
  ): Promise<{ success: boolean; harPath: string }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.routeFromHAR(harPath, options);
    this.sessionManager.updateActivity(sessionId);
    return { success: true, harPath };
  }

  async unrouteAll(
    sessionId: string,
    pageId: string,
    options: { behavior?: 'wait' | 'ignoreErrors' | 'default' } = {}
  ): Promise<{ success: boolean }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    await page.unrouteAll(options);
    this.sessionManager.updateActivity(sessionId);
    return { success: true };
  }
}
