/**
 * Core Types for MCP Playwright Server
 *
 * @see https://playwright.dev/docs/locators#quick-guide
 * @see https://playwright.dev/docs/best-practices
 * @see https://playwright.dev/docs/test-assertions
 * @see https://www.w3.org/TR/wai-aria-1.2/#roles
 */
import type { Browser, BrowserContext, Page } from 'playwright';

// Standard Response Types

export interface StandardResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  };
  metadata: {
    timestamp: string;
    executionTime?: number;
    requestId?: string;
    sessionId?: string;
    pageId?: string;
  };
}

export interface AssertionResult<T> {
  success: boolean;
  expected?: T;
  actual?: T;
  message?: string;
}

// Shared Primitive Types

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

// Viewport and Position Types

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

export type AriaRole = (typeof ARIA_ROLES)[number];

// ============================================
// Role-Based Locator Options (Playwright Best Practices)
// ============================================

/**
 * Options for getByRole locator.
 * **Most recommended locator strategy by Playwright.**
 *
 * Role-based locators reflect how users and assistive technologies
 * perceive the page. They're resilient to DOM changes and encourage
 * accessible markup.
 *
 * **Priority Order for Locator Selection:**
 * 1. `getByRole()` - This one! Best for interactive elements
 * 2. `getByLabel()` - For form inputs with labels
 * 3. `getByPlaceholder()` - For inputs without visible labels
 * 4. `getByText()` - For elements identified by their text content
 * 5. `getByTestId()` - For elements with data-testid attributes
 *
 * **When to Use Which Option:**
 * - `name`: Most common - filters by accessible name (visible text, aria-label)
 * - `exact`: Set true when name might partially match multiple elements
 * - `checked/disabled/expanded`: Filter by ARIA state attributes
 * - `pressed/selected`: For toggle buttons and selection states
 * - `level`: Specifically for heading elements (h1=1, h2=2, etc.)
 *
 * @see https://playwright.dev/docs/locators#locate-by-role
 * @see https://www.w3.org/TR/wai-aria-1.2/#roles
 *
 * @example
 * ```typescript
 * // Click a submit button
 * await page.getByRole('button', { name: 'Submit' }).click();
 *
 * // Find a specific heading level
 * await page.getByRole('heading', { level: 2 }).first();
 *
 * // Check an unchecked checkbox
 * await page.getByRole('checkbox', { name: 'Accept terms', checked: false }).check();
 *
 * // Click a pressed toggle button
 * await page.getByRole('button', { name: 'Bold', pressed: true }).click();
 *
 * // Click expanded menu item
 * await page.getByRole('menuitem', { name: 'File', expanded: true }).click();
 *
 * // Find navigation landmark
 * await page.getByRole('navigation').getByRole('link', { name: 'Home' }).click();
 * ```
 */
export interface RoleLocatorOptions extends BaseLocatorOptions {
  /** ARIA role to locate (button, link, heading, textbox, etc.) */
  role: AriaRole;
  /** Accessible name to filter by (button text, link text, label, etc.) */
  name?: string | RegExp;
  /** Whether name match should be exact (case-sensitive, whole-string) */
  exact?: boolean;
  /** Filter by aria-checked or native checkbox state */
  checked?: boolean;
  /** Filter by aria-disabled or disabled attribute */
  disabled?: boolean;
  /** Filter by aria-expanded (dropdowns, accordions) */
  expanded?: boolean;
  /** Include elements hidden from accessibility tree */
  includeHidden?: boolean;
  /** Heading level (1-6) for role="heading" */
  level?: number;
  /** Filter by aria-pressed for toggle buttons */
  pressed?: boolean;
  /** Filter by aria-selected (tabs, listbox options) */
  selected?: boolean;
}

/**
 * Options for getByText locator.
 *
 * @example
 * ```typescript
 * await page.getByText('Welcome').click();
 * await page.getByText(/hello/i).first();
 * ```
 */
export interface TextLocatorOptions extends BaseLocatorOptions {
  text: string | RegExp;
  exact?: boolean;
}

/**
 * Options for getByLabel locator.
 * **Recommended for form inputs** - matches how users identify form fields.
 *
 * This locator finds inputs by:
 * 1. Associated `<label>` element (via `for` attribute or nesting)
 * 2. `aria-labelledby` attribute reference
 * 3. `aria-label` attribute value
 *
 * **Best Practice:** Always use labels for form inputs - it improves
 * accessibility and makes testing easier.
 *
 * @see https://playwright.dev/docs/locators#locate-by-label
 * @see https://www.w3.org/WAI/tutorials/forms/labels/
 *
 * @example
 * ```typescript
 * // Fill email input (matches label containing "email")
 * await page.getByLabel('Email').fill('user@example.com');
 *
 * // Exact match for ambiguous labels
 * await page.getByLabel('Password', { exact: true }).fill('secret');
 *
 * // Works with aria-label
 * await page.getByLabel('Search').fill('playwright');
 *
 * // Works with nested label
 * // <label>Email <input type="email" /></label>
 * await page.getByLabel('Email').fill('test@test.com');
 * ```
 */
export interface LabelLocatorOptions extends BaseLocatorOptions {
  /** Label text to match (case-insensitive substring by default) */
  label: string | RegExp;
  /** Whether to match exact text (case-sensitive, whole-string) */
  exact?: boolean;
}

/**
 * Options for getByTestId locator.
 * Uses data-testid attribute for stable element identification.
 *
 * **When to use test IDs:**
 * - Element doesn't have good semantic role/label
 * - Text content changes frequently (e.g., i18n)
 * - Need guaranteed stable selector for CI/CD
 * - Complex components where semantic locators are ambiguous
 *
 * **When NOT to use test IDs:**
 * - Element has clear semantic role (use getByRole instead)
 * - Element has a label (use getByLabel instead)
 * - Element has unique visible text (use getByText instead)
 *
 * **Best Practice:** Prefer role/label locators when possible,
 * use test IDs as a reliable fallback for complex cases.
 *
 * The test ID attribute can be configured via `testIdAttribute` in config.
 * Default: `data-testid`
 *
 * @see https://playwright.dev/docs/locators#locate-by-test-id
 *
 * @example
 * ```typescript
 * // HTML: <button data-testid="submit-btn">Submit</button>
 * await page.getByTestId('submit-btn').click();
 *
 * // Custom test ID attribute (configured in playwright.config)
 * // HTML: <button data-cy="submit">Submit</button>
 * await page.getByTestId('submit').click();
 *
 * // Combining with other locators
 * await page.getByTestId('user-row').getByRole('button', { name: 'Delete' }).click();
 * ```
 */
export interface TestIdLocatorOptions extends BaseLocatorOptions {
  /** Test ID value (data-testid attribute value) */
  testId: string | RegExp;
}

/**
 * Options for getByPlaceholder locator.
 *
 * @example
 * ```typescript
 * await page.getByPlaceholder('Enter email...').fill('user@example.com');
 * ```
 */
export interface PlaceholderLocatorOptions extends BaseLocatorOptions {
  placeholder: string | RegExp;
  exact?: boolean;
}

/**
 * Options for getByAltText locator.
 * For images with alt text.
 *
 * @example
 * ```typescript
 * await page.getByAltText('Company logo').click();
 * ```
 */
export interface AltTextLocatorOptions extends BaseLocatorOptions {
  altText: string | RegExp;
  exact?: boolean;
}

/**
 * Options for getByTitle locator.
 * For elements with title attribute.
 *
 * @example
 * ```typescript
 * await page.getByTitle('Close dialog').click();
 * ```
 */
export interface TitleLocatorOptions extends BaseLocatorOptions {
  title: string | RegExp;
  exact?: boolean;
}

// ============================================
// Assertion Options
// ============================================

/**
 * Base options for web-first assertions.
 * All assertions auto-retry until timeout.
 *
 * @see https://playwright.dev/docs/test-assertions
 */
export interface AssertionOptions extends SessionPageRef {
  selector?: string;
  timeout?: number;
}

/**
 * Options for text assertions.
 */
export interface TextAssertionOptions extends AssertionOptions {
  expectedText: string | RegExp;
  exact?: boolean;
  ignoreCase?: boolean;
}

/**
 * Options for attribute assertions.
 */
export interface AttributeAssertionOptions extends AssertionOptions {
  attribute: string;
  expectedValue: string | RegExp;
}

/**
 * Options for URL assertions.
 */
export interface UrlAssertionOptions extends SessionPageRef {
  expectedUrl: string | RegExp;
  timeout?: number;
}

/**
 * Options for title assertions.
 */
export interface TitleAssertionOptions extends SessionPageRef {
  expectedTitle: string | RegExp;
  timeout?: number;
}

// ============================================
// Frame and Advanced Locator Options
// ============================================

/**
 * Options for frame locator operations.
 *
 * @example
 * ```typescript
 * await page.frameLocator('#payment-iframe').getByLabel('Card number').fill('4242...');
 * ```
 */
export interface FrameLocatorOptions extends SessionPageRef {
  frameSelector: string;
  elementSelector: string;
  timeout?: number;
}

/**
 * Options for drag and drop operations.
 */
export interface DragDropOptions extends SessionPageRef {
  sourceSelector: string;
  targetSelector: string;
  sourcePosition?: Position;
  targetPosition?: Position;
  timeout?: number;
}

// ============================================
// Storage and Session Options
// ============================================

/**
 * Options for saving/loading storage state.
 * Used for authentication persistence.
 *
 * @see https://playwright.dev/docs/auth
 */
export interface StorageStateOptions {
  sessionId: string;
  path?: string;
}

/**
 * Options for select element operations.
 */
export interface SelectOptionOptions extends SessionPageRef {
  selector: string;
  values:
    | string
    | string[]
    | { value?: string; label?: string; index?: number }[];
  timeout?: number;
}

/**
 * Options for checkbox/radio operations.
 */
export interface CheckboxOptions extends SessionPageRef {
  selector: string;
  checked: boolean;
  force?: boolean;
  timeout?: number;
}

// ============================================
// Page Configuration Options
// ============================================

/**
 * Options for preparing/configuring a page.
 */
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

/**
 * Options for network route/mock.
 */
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

// ============================================
// Utility Types
// ============================================

/**
 * Make specific properties required.
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make all properties optional recursively.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
