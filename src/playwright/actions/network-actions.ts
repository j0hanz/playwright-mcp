// Network Actions - HAR routing and network interception

import { BaseAction } from './base-action.js';

export class NetworkActions extends BaseAction {
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
    return this.executePageOperation(
      sessionId,
      pageId,
      'Route from HAR',
      async (page) => {
        await page.routeFromHAR(harPath, options);
        return { success: true, harPath };
      },
      { harPath, ...options }
    );
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
    return this.executeContextOperation(
      sessionId,
      'Context route from HAR',
      async (context) => {
        await context.routeFromHAR(harPath, options);
        return { success: true, harPath };
      },
      { harPath, ...options }
    );
  }

  async unrouteAll(
    sessionId: string,
    pageId: string,
    options: { behavior?: 'wait' | 'ignoreErrors' | 'default' } = {}
  ): Promise<{ success: boolean }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Unroute all',
      async (page) => {
        await page.unrouteAll(options);
        return { success: true };
      },
      { ...options }
    );
  }
}
