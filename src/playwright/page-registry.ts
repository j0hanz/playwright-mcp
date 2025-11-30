import type { Page } from 'playwright';

import { ErrorCode, ErrorHandler } from '../utils/error-handler.js';

/** Page entry with metadata */
export interface PageEntry {
  /** Unique page identifier */
  id: string;
  /** Playwright page instance */
  page: Page;
  /** Timestamp when page was created */
  createdAt: Date;
}

/** Summary of a page for external reporting */
export interface PageSummary {
  id: string;
  url: string;
  title: string;
  isActive: boolean;
}

/**
 * Registry for managing pages within a session.
 *
 * Provides:
 * - Page storage and lookup with O(1) access
 * - Active page tracking
 * - Page lifecycle events via callbacks
 */
export class PageRegistry {
  private pages = new Map<string, PageEntry>();
  private activePageId?: string;

  /** Callback invoked when a page is removed */
  onPageRemoved?: (pageId: string, page: Page) => void;

  /**
   * Add a page to the registry.
   * @param pageId Unique identifier for the page
   * @param page Playwright page instance
   * @param setActive Whether to make this the active page (default: true)
   */
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

  /**
   * Get a page by ID.
   * @throws {MCPPlaywrightError} PAGE_NOT_FOUND if page doesn't exist
   */
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

  /**
   * Check if a page exists in the registry.
   */
  has(pageId: string): boolean {
    return this.pages.has(pageId);
  }

  /**
   * Remove a page from the registry.
   * @returns true if page was removed, false if it didn't exist
   */
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

  /**
   * Get the currently active page ID.
   */
  getActiveId(): string | undefined {
    return this.activePageId;
  }

  /**
   * Set the active page.
   * @throws {MCPPlaywrightError} PAGE_NOT_FOUND if page doesn't exist
   */
  setActive(pageId: string): void {
    if (!this.pages.has(pageId)) {
      throw ErrorHandler.createError(
        ErrorCode.PAGE_NOT_FOUND,
        `Cannot set active page, page not found: ${pageId}`
      );
    }
    this.activePageId = pageId;
  }

  /**
   * Get all page IDs.
   */
  getIds(): string[] {
    return Array.from(this.pages.keys());
  }

  /**
   * Get all page entries.
   */
  getAll(): PageEntry[] {
    return Array.from(this.pages.values());
  }

  /**
   * Get the number of pages.
   */
  get size(): number {
    return this.pages.size;
  }

  /**
   * Clear all pages from the registry.
   * Invokes onPageRemoved callback for each page.
   */
  clear(): void {
    for (const [pageId, entry] of this.pages) {
      if (this.onPageRemoved) {
        this.onPageRemoved(pageId, entry.page);
      }
    }
    this.pages.clear();
    this.activePageId = undefined;
  }

  /**
   * Get page summaries for external reporting.
   * Note: This is async because it fetches page title/URL.
   */
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
