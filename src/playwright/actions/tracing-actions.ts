// Tracing Actions - Playwright trace recording and grouping

import { Logger } from '../../utils/logger.js';
import { SessionManager } from '../session-manager.js';

export class TracingActions {
  constructor(
    private sessionManager: SessionManager,
    private logger: Logger
  ) {}

  async startTracing(
    sessionId: string,
    options: {
      screenshots?: boolean;
      snapshots?: boolean;
      sources?: boolean;
    } = {}
  ): Promise<{ success: boolean }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.tracing.start(options);
    this.sessionManager.updateActivity(sessionId);
    return { success: true };
  }

  async stopTracing(
    sessionId: string,
    path: string
  ): Promise<{ success: boolean; path: string }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.tracing.stop({ path });
    this.sessionManager.updateActivity(sessionId);
    return { success: true, path };
  }

  async startTracingGroup(
    sessionId: string,
    name: string,
    options: {
      location?: { file: string; line?: number; column?: number };
    } = {}
  ): Promise<{ success: boolean; groupName: string }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.tracing.group(name, options);
    this.sessionManager.updateActivity(sessionId);
    return { success: true, groupName: name };
  }

  async endTracingGroup(sessionId: string): Promise<{ success: boolean }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.tracing.groupEnd();
    this.sessionManager.updateActivity(sessionId);
    return { success: true };
  }
}
