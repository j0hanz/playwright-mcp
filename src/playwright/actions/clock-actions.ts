// Clock Actions - Time manipulation for testing

import { BaseAction } from './base-action.js';

/** Converts various time inputs to ISO string */
function toISOString(time: number | string | Date): string {
  return new Date(time).toISOString();
}

export class ClockActions extends BaseAction {
  async installClock(
    sessionId: string,
    pageId: string,
    options: { time?: number | string | Date } = {}
  ): Promise<{ success: boolean; installedTime?: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Install clock',
      async (page) => {
        const time = options.time ? new Date(options.time) : undefined;
        await page.clock.install({ time });
        return {
          success: true,
          installedTime: time ? toISOString(time) : toISOString(new Date()),
        };
      }
    );
  }

  async setFixedTime(
    sessionId: string,
    pageId: string,
    time: number | string | Date
  ): Promise<{ success: boolean; fixedTime: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Set fixed time',
      async (page) => {
        const fixedDate = new Date(time);
        await page.clock.setFixedTime(fixedDate);
        return { success: true, fixedTime: toISOString(fixedDate) };
      },
      { time: toISOString(time) }
    );
  }

  async pauseClock(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; pausedAt: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Pause clock',
      async (page) => {
        const currentTime = await page.evaluate(() => Date.now());
        await page.clock.pauseAt(currentTime);
        return { success: true, pausedAt: toISOString(currentTime) };
      }
    );
  }

  async resumeClock(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Resume clock',
      async (page) => {
        await page.clock.resume();
        return { success: true };
      }
    );
  }

  async runClockFor(
    sessionId: string,
    pageId: string,
    duration: number | string
  ): Promise<{ success: boolean; advancedBy: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Run clock for',
      async (page) => {
        await page.clock.runFor(duration);
        return {
          success: true,
          advancedBy: typeof duration === 'number' ? `${duration}ms` : duration,
        };
      },
      { duration: typeof duration === 'number' ? `${duration}ms` : duration }
    );
  }

  async fastForwardClock(
    sessionId: string,
    pageId: string,
    ticks: number | string
  ): Promise<{ success: boolean; fastForwardedBy: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Fast forward clock',
      async (page) => {
        await page.clock.fastForward(ticks);
        return {
          success: true,
          fastForwardedBy: typeof ticks === 'number' ? `${ticks}ms` : ticks,
        };
      },
      { ticks: typeof ticks === 'number' ? `${ticks}ms` : ticks }
    );
  }

  async setSystemTime(
    sessionId: string,
    pageId: string,
    time: number | string | Date
  ): Promise<{ success: boolean; systemTime: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Set system time',
      async (page) => {
        const newTime = new Date(time);
        await page.clock.setSystemTime(newTime);
        return { success: true, systemTime: toISOString(newTime) };
      },
      { time: toISOString(time) }
    );
  }
}
