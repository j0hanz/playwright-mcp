// Core types for MCP Playwright Server
import type { Browser, BrowserContext, Page } from 'playwright';

// Standard response type for tool results
export interface StandardResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata: {
    timestamp: string;
    executionTime?: number;
    requestId?: string;
  };
}

// Shared primitive types
export type BrowserType = 'chromium' | 'firefox' | 'webkit';
export type MouseButton = 'left' | 'middle' | 'right';
export type KeyModifier = 'Alt' | 'Control' | 'Meta' | 'Shift';
export type WaitUntilState =
  | 'load'
  | 'domcontentloaded'
  | 'networkidle'
  | 'commit';

// Browser session types
export interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  pages: Map<string, Page>;
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  browserType: BrowserType;
  launchTime: Date;
  lastActivity: Date;
  headless: boolean;
  activePageId?: string;
}

// Viewport and position types
export interface Viewport {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface ClipRegion extends Position {
  width: number;
  height: number;
}

// Common session-page identifier
interface SessionPageRef {
  sessionId: string;
  pageId: string;
}

// Navigation options
export interface NavigationOptions {
  sessionId: string;
  url: string;
  waitUntil?: WaitUntilState;
  timeout?: number;
}

// Element interaction options
export interface ElementInteractionOptions extends SessionPageRef {
  selector: string;
  timeout?: number;
  force?: boolean;
  position?: Position;
  button?: MouseButton;
  clickCount?: number;
  modifiers?: KeyModifier[];
  delay?: number;
}

// Screenshot options
export interface ScreenshotOptions extends SessionPageRef {
  fullPage?: boolean;
  path?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
  clip?: ClipRegion;
  mask?: string[];
}

// ARIA roles - comprehensive list for accessibility locators
export const ARIA_ROLES = [
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'blockquote',
  'button',
  'caption',
  'cell',
  'checkbox',
  'code',
  'columnheader',
  'combobox',
  'complementary',
  'contentinfo',
  'definition',
  'deletion',
  'dialog',
  'directory',
  'document',
  'emphasis',
  'feed',
  'figure',
  'form',
  'generic',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'insertion',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'meter',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'navigation',
  'none',
  'note',
  'option',
  'paragraph',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'strong',
  'subscript',
  'superscript',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'time',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
] as const;

export type AriaRole = (typeof ARIA_ROLES)[number];

export interface RoleLocatorOptions extends SessionPageRef {
  role: AriaRole;
  name?: string | RegExp;
  exact?: boolean;
  checked?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  includeHidden?: boolean;
  level?: number;
  pressed?: boolean;
  selected?: boolean;
}

export interface TextLocatorOptions extends SessionPageRef {
  text: string;
  exact?: boolean;
}

export interface LabelLocatorOptions extends SessionPageRef {
  label: string;
  exact?: boolean;
}

export interface TestIdLocatorOptions extends SessionPageRef {
  testId: string;
}

export interface PlaceholderLocatorOptions extends SessionPageRef {
  placeholder: string;
  exact?: boolean;
}

export interface AssertionOptions extends SessionPageRef {
  selector?: string;
  timeout?: number;
}

export interface FrameLocatorOptions extends SessionPageRef {
  frameSelector: string;
  elementSelector: string;
}

export interface DragDropOptions extends SessionPageRef {
  sourceSelector: string;
  targetSelector: string;
  sourcePosition?: Position;
  targetPosition?: Position;
}

export interface StorageStateOptions {
  sessionId: string;
  path?: string;
}

export interface SelectOptionOptions extends SessionPageRef {
  selector: string;
  values:
    | string
    | string[]
    | { value?: string; label?: string; index?: number }[];
  timeout?: number;
}

export interface CheckboxOptions extends SessionPageRef {
  selector: string;
  checked: boolean;
  force?: boolean;
  timeout?: number;
}
