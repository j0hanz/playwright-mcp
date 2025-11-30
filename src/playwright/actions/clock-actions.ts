import { Logger } from '../../utils/logger.js';
import { SessionManager } from '../session-manager.js';

export class ClockActions {
  constructor(
    private sessionManager: SessionManager,
    private logger: Logger
  ) {}

  async installClock(
    sessionId: string,
    pageId: string,
    options: { time?: number | string | Date } = {}
  ): Promise<{ success: boolean; installedTime?: string }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    const time = options.time ? new Date(options.time) : undefined;
    await page.clock.install({ time });
    this.sessionManager.updateActivity(sessionId);
    return {
      success: true,
      installedTime: time?.toISOString() ?? new Date().toISOString(),
    };
  }

  async setFixedTime(
    sessionId: string,
    pageId: string,
    time: number | string | Date
  ): Promise<{ success: boolean; fixedTime: string }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    const fixedDate = new Date(time);
    await page.clock.setFixedTime(fixedDate);
    this.sessionManager.updateActivity(sessionId);
    return { success: true, fixedTime: fixedDate.toISOString() };
  }

  async pauseClock(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; pausedAt: string }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    const currentTime = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(currentTime);
    this.sessionManager.updateActivity(sessionId);
    return { success: true, pausedAt: new Date(currentTime).toISOString() };
  }

  async resumeClock(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    await page.clock.resume();
    this.sessionManager.updateActivity(sessionId);
    return { success: true };
  }

  async runClockFor(
    sessionId: string,
    pageId: string,
    duration: number | string
  ): Promise<{ success: boolean; advancedBy: string }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    await page.clock.runFor(duration);
    this.sessionManager.updateActivity(sessionId);
    return {
      success: true,
      advancedBy: typeof duration === 'number' ? `${duration}ms` : duration,
    };
  }

  async fastForwardClock(
    sessionId: string,
    pageId: string,
    ticks: number | string
  ): Promise<{ success: boolean; fastForwardedBy: string }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    await page.clock.fastForward(ticks);
    this.sessionManager.updateActivity(sessionId);
    return {
      success: true,
      fastForwardedBy: typeof ticks === 'number' ? `${ticks}ms` : ticks,
    };
  }

  async setSystemTime(
    sessionId: string,
    pageId: string,
    time: number | string | Date
  ): Promise<{ success: boolean; systemTime: string }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    const newTime = new Date(time);
    await page.clock.setSystemTime(newTime);
    this.sessionManager.updateActivity(sessionId);
    return { success: true, systemTime: newTime.toISOString() };
  }
}
