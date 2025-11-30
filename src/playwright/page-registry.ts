// Page Registry - Manages pages within a browser session

import type { Page } from 'playwright';

import { ErrorCode, ErrorHandler } from '../utils/error-handler.js';

export interface PageEntry {
  id: string;
  page: Page;
  createdAt: Date;
}

export interface PageSummary {
  id: string;
  url: string;
  title: string;
  isActive: boolean;
}

export class PageRegistry {
  private pages = new Map<string, PageEntry>();
  private activePageId?: string;

  onPageRemoved?: (pageId: string, page: Page) => void;

  add(pageId: string, page: Page, setActive = true): void {
    const entry: PageEntry = {
      id: pageId,
      page,
      createdAt: new Date(),
    };

    this.pages.set(pageId, entry);

    if (setActive) {
      this.activePageId = pageId;
    }
  }

  get(pageId: string): Page {
    const entry = this.pages.get(pageId);
    if (!entry) {
      throw ErrorHandler.createError(
        ErrorCode.PAGE_NOT_FOUND,
        `Page not found: ${pageId}`
      );
    }
    return entry.page;
  }

  has(pageId: string): boolean {
    return this.pages.has(pageId);
  }

  remove(pageId: string): boolean {
    const entry = this.pages.get(pageId);
    if (!entry) return false;

    const deleted = this.pages.delete(pageId);

    // Update active page if needed
    if (this.activePageId === pageId) {
      const remaining = Array.from(this.pages.keys());
      this.activePageId = remaining.length > 0 ? remaining[0] : undefined;
    }

    // Notify callback
    if (deleted && this.onPageRemoved) {
      this.onPageRemoved(pageId, entry.page);
    }

    return deleted;
  }

  getActiveId(): string | undefined {
    return this.activePageId;
  }

  setActive(pageId: string): void {
    if (!this.pages.has(pageId)) {
      throw ErrorHandler.createError(
        ErrorCode.PAGE_NOT_FOUND,
        `Cannot set active page, page not found: ${pageId}`
      );
    }
    this.activePageId = pageId;
  }

  getIds(): string[] {
    return Array.from(this.pages.keys());
  }

  getAll(): PageEntry[] {
    return Array.from(this.pages.values());
  }

  get size(): number {
    return this.pages.size;
  }

  clear(): void {
    for (const [pageId, entry] of this.pages) {
      if (this.onPageRemoved) {
        this.onPageRemoved(pageId, entry.page);
      }
    }
    this.pages.clear();
    this.activePageId = undefined;
  }

  async getSummaries(): Promise<PageSummary[]> {
    const summaries: PageSummary[] = [];

    for (const [pageId, entry] of this.pages) {
      try {
        summaries.push({
          id: pageId,
          url: entry.page.url(),
          title: await entry.page.title(),
          isActive: pageId === this.activePageId,
        });
      } catch {
        // Page may have been closed, skip it
        summaries.push({
          id: pageId,
          url: 'about:blank',
          title: '<closed>',
          isActive: pageId === this.activePageId,
        });
      }
    }

    return summaries;
  }
}

export default PageRegistry;
