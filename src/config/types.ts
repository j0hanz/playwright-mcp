// Common Types and Constants for MCP Playwright Server
//
// References:
// - https://playwright.dev/docs/locators
// - https://playwright.dev/docs/best-practices
// - https://playwright.dev/docs/test-assertions
// - https://playwright.dev/docs/auth
// - https://www.w3.org/TR/wai-aria-1.2/#roles
// - https://www.w3.org/WAI/tutorials/forms/labels

import type { Browser, BrowserContext, Page } from 'playwright';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ARIA Roles

export const ARIA_ROLES = [
  // Widget roles
  'button',
  'checkbox',
  'combobox',
  'gridcell',
  'link',
  'listbox',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'progressbar',
  'radio',
  'scrollbar',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'tabpanel',
  'textbox',
  'treeitem',
  // Document structure roles
  'article',
  'blockquote',
  'caption',
  'cell',
  'code',
  'columnheader',
  'definition',
  'deletion',
  'directory',
  'document',
  'emphasis',
  'feed',
  'figure',
  'generic',
  'group',
  'heading',
  'img',
  'insertion',
  'list',
  'listitem',
  'math',
  'meter',
  'none',
  'note',
  'paragraph',
  'presentation',
  'row',
  'rowgroup',
  'rowheader',
  'strong',
  'subscript',
  'superscript',
  'table',
  'term',
  'time',
  // Landmark roles
  'application',
  'banner',
  'complementary',
  'contentinfo',
  'form',
  'main',
  'navigation',
  'region',
  'search',
  // Live region roles
  'alert',
  'alertdialog',
  'dialog',
  'log',
  'marquee',
  'status',
  'timer',
  // Composite roles
  'grid',
  'radiogroup',
  'tablist',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
] as const;

// Note: Import ErrorCode directly from '../utils/error-handler.js' where needed
// Note: Import browserChannels from './playwright-config.js' where needed

// Primitive Types

export type BrowserType = 'chromium' | 'firefox' | 'webkit';
export type MouseButton = 'left' | 'middle' | 'right';
export type KeyModifier = 'Alt' | 'Control' | 'Meta' | 'Shift';
export type WaitUntilState =
  | 'load'
  | 'domcontentloaded'
  | 'networkidle'
  | 'commit';
export type ElementState = 'visible' | 'hidden' | 'attached' | 'detached';
export type ColorScheme = 'light' | 'dark' | 'no-preference';
export type ReducedMotion = 'reduce' | 'no-preference';
export type ForcedColors = 'active' | 'none';
export type AriaRole = (typeof ARIA_ROLES)[number];

// Viewport and Position

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

export type BoundingBox = ClipRegion;

// Response Types

export interface AssertionResult<T> {
  success: boolean;
  expected?: T;
  actual?: T;
  message?: string;
}

// Browser Session Types

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
  userAgent?: string;
  viewport?: Viewport;
}

export interface SessionCreateOptions {
  browser: Browser;
  context: BrowserContext;
  browserType: BrowserType;
  headless: boolean;
  viewport?: Viewport;
}

export interface SessionInfo {
  id: string;
  browserType: string;
  pageCount: number;
  lastActivity: Date;
  idleMs?: number;
  headless?: boolean;
}

export interface SessionManagerConfig {
  maxConcurrentSessions: number;
  maxSessionsPerMinute: number;
}

export type SessionCleanupCallback = (
  sessionId: string,
  session: BrowserSession
) => Promise<void>;

// Rate Limiter Types

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  maxTracked?: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

// Browser Launch Options

export interface BrowserLaunchOptions {
  browserType?: BrowserType;
  headless?: boolean;
  viewport?: Viewport;
  userAgent?: string;
  timeout?: number;
  channel?: string;
  slowMo?: number;
  proxy?: {
    server: string;
    bypass?: string;
    username?: string;
    password?: string;
  };
  recordVideo?: {
    dir: string;
    size?: Viewport;
  };
  storageState?: string;
}

// Common Reference Types

export interface SessionPageRef {
  sessionId: string;
  pageId: string;
}

export interface BaseLocatorOptions extends SessionPageRef {
  timeout?: number;
}

// Navigation Options

export interface NavigationOptions {
  sessionId: string;
  url: string;
  waitUntil?: WaitUntilState;
  timeout?: number;
  referer?: string;
}

export interface WaitForSelectorOptions extends SessionPageRef {
  selector: string;
  state?: ElementState;
  timeout?: number;
  strict?: boolean;
}

// Element Interaction Options

export interface ElementInteractionOptions extends SessionPageRef {
  selector: string;
  timeout?: number;
  force?: boolean;
  noWaitAfter?: boolean;
  position?: Position;
  button?: MouseButton;
  clickCount?: number;
  modifiers?: KeyModifier[];
  delay?: number;
  trial?: boolean;
}

export interface FillOptions extends SessionPageRef {
  selector: string;
  text: string;
  timeout?: number;
  force?: boolean;
  noWaitAfter?: boolean;
}

export interface HoverOptions extends SessionPageRef {
  selector: string;
  timeout?: number;
  force?: boolean;
  position?: Position;
  modifiers?: KeyModifier[];
  trial?: boolean;
}

// Screenshot Options

export interface ScreenshotOptions extends SessionPageRef {
  fullPage?: boolean;
  path?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
  clip?: ClipRegion;
  mask?: string[];
  omitBackground?: boolean;
  scale?: 'css' | 'device';
  animations?: 'disabled' | 'allow';
  caret?: 'hide' | 'initial';
}

// Locator Options

export interface RoleLocatorOptions extends BaseLocatorOptions {
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

export interface TextLocatorOptions extends BaseLocatorOptions {
  text: string | RegExp;
  exact?: boolean;
}

export interface LabelLocatorOptions extends BaseLocatorOptions {
  label: string | RegExp;
  exact?: boolean;
}

export interface TestIdLocatorOptions extends BaseLocatorOptions {
  testId: string | RegExp;
}

export interface PlaceholderLocatorOptions extends BaseLocatorOptions {
  placeholder: string | RegExp;
  exact?: boolean;
}

export interface AltTextLocatorOptions extends BaseLocatorOptions {
  altText: string | RegExp;
  exact?: boolean;
}

export interface TitleLocatorOptions extends BaseLocatorOptions {
  title: string | RegExp;
  exact?: boolean;
}

// Assertion Options

export interface AssertionOptions extends SessionPageRef {
  selector?: string;
  timeout?: number;
}

export interface TextAssertionOptions extends AssertionOptions {
  expectedText: string | RegExp;
  exact?: boolean;
  ignoreCase?: boolean;
}

export interface AttributeAssertionOptions extends AssertionOptions {
  attribute: string;
  expectedValue: string | RegExp;
}

export interface UrlAssertionOptions extends SessionPageRef {
  expectedUrl: string | RegExp;
  timeout?: number;
}

export interface TitleAssertionOptions extends SessionPageRef {
  expectedTitle: string | RegExp;
  timeout?: number;
}

// Frame and Advanced Locator Options

export interface FrameLocatorOptions extends SessionPageRef {
  frameSelector: string;
  elementSelector: string;
  timeout?: number;
}

export interface DragDropOptions extends SessionPageRef {
  sourceSelector: string;
  targetSelector: string;
  sourcePosition?: Position;
  targetPosition?: Position;
  timeout?: number;
}

// Storage and Session Options

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

// Page Configuration Options

export interface PagePrepareOptions extends SessionPageRef {
  viewport?: Viewport;
  userAgent?: string;
  extraHTTPHeaders?: Record<string, string>;
  geolocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  permissions?: string[];
  colorScheme?: ColorScheme;
  reducedMotion?: ReducedMotion;
  forcedColors?: ForcedColors;
  locale?: string;
  timezoneId?: string;
}

export interface NetworkRouteOptions extends SessionPageRef {
  urlPattern: string;
  response?: {
    status?: number;
    body?: string;
    headers?: Record<string, string>;
    contentType?: string;
    delay?: number;
    failureMode?: 'timeout' | 'abort' | 'malformed-json';
  };
}

// Server Configuration - Re-exported from server-config for single source of truth
export type { ServerConfig } from './server-config.js';

// Tool Handler Response Types

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export type ToolContent = Array<TextContent | ImageContent>;

export interface ToolResponse<T = unknown> {
  content: ToolContent;
  structuredContent?: T;
  isError?: boolean;
}

export interface ErrorResponse {
  [key: string]: unknown;
  content: [TextContent];
  isError: true;
  requestId?: string;
}

// Pagination Types

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// Tool Context Types - Forward-compatible interface for handler registration
// Uses BrowserManager and Logger interfaces to avoid circular dependencies

import type { BrowserManager } from '../playwright/browser-manager.js';
import type { Logger } from '../utils/logger.js';

export interface ToolContext {
  server: McpServer;
  browserManager: BrowserManager;
  logger: Logger;
  createToolHandler: <T, R extends { structuredContent?: unknown }>(
    handler: (input: T) => Promise<R>,
    errorMessage: string
  ) => (input: T) => Promise<R | ErrorResponse>;
}

export type ToolRegistrationFn = (ctx: ToolContext) => void;

// Re-export Zod schemas from centralized location (single source of truth)
// @see src/server/handlers/schemas.ts for all schema definitions
export {
  viewportSchema,
  positionSchema,
  testScenarioSchema,
  type ViewportInput,
  type PositionInput,
  type TestScenarioInput,
} from '../server/handlers/schemas.js';

// Accessibility Types

export interface AccessibilityNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

export interface AccessibilityViolation {
  id: string;
  impact?: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: AccessibilityNode[];
}

// Logger Types

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LogMeta = Record<string, unknown>;

export interface TimerResult {
  done: (meta?: LogMeta) => number;
  elapsed: () => number;
  cancel: () => void;
}

export interface PerformanceMetrics {
  operation: string;
  durationMs: number;
  success: boolean;
  error?: string;
}
