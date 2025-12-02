// Tracing Actions - Playwright trace recording and grouping

import { BaseAction } from './base-action.js';

export class TracingActions extends BaseAction {
  async startTracing(
    sessionId: string,
    options: {
      screenshots?: boolean;
      snapshots?: boolean;
      sources?: boolean;
    } = {}
  ): Promise<{ success: boolean }> {
    return this.executeContextOperation(
      sessionId,
      'Start tracing',
      async (context) => {
        await context.tracing.start(options);
        return { success: true };
      },
      { options }
    );
  }

  async stopTracing(
    sessionId: string,
    path: string
  ): Promise<{ success: boolean; path: string }> {
    return this.executeContextOperation(
      sessionId,
      'Stop tracing',
      async (context) => {
        await context.tracing.stop({ path });
        return { success: true, path };
      },
      { path }
    );
  }

  async startTracingGroup(
    sessionId: string,
    name: string,
    options: {
      location?: { file: string; line?: number; column?: number };
    } = {}
  ): Promise<{ success: boolean; groupName: string }> {
    return this.executeContextOperation(
      sessionId,
      'Start tracing group',
      async (context) => {
        await context.tracing.group(name, options);
        return { success: true, groupName: name };
      },
      { groupName: name }
    );
  }

  async endTracingGroup(sessionId: string): Promise<{ success: boolean }> {
    return this.executeContextOperation(
      sessionId,
      'End tracing group',
      async (context) => {
        await context.tracing.groupEnd();
        return { success: true };
      }
    );
  }
}
