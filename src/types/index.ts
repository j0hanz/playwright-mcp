/**
 * Core Types for MCP Playwright Server
 *
 * This module provides comprehensive type definitions following Playwright best practices:
 *
 * **Locator Strategy Types** (Priority Order - Playwright Recommended):
 * 1. `RoleLocatorOptions` - getByRole() - Most recommended, reflects user perception
 * 2. `LabelLocatorOptions` - getByLabel() - Best for form inputs
 * 3. `PlaceholderLocatorOptions` - getByPlaceholder() - For inputs without labels
 * 4. `TextLocatorOptions` - getByText() - For visible text content
 * 5. `TestIdLocatorOptions` - getByTestId() - For data-testid attributes
 * 6. `AltTextLocatorOptions` - getByAltText() - For images
 *
 * **Web-First Assertion Types**:
 * - Auto-retrying assertions that wait for conditions
 * - Eliminates flakiness from timing issues
 *
 * **Session Management Types**:
 * - Browser session lifecycle
 * - Page and context management
 *
 * **Best Practice Guidelines**:
 * - Prefer semantic locators (role, label, text) over CSS/XPath
 * - Use web-first assertions that auto-retry
 * - Keep sessions isolated with separate contexts
 * - Clean up resources properly on close
 *
 * @see https://playwright.dev/docs/locators#quick-guide
 * @see https://playwright.dev/docs/best-practices
 * @see https://playwright.dev/docs/test-assertions
 */
import type { Browser, BrowserContext, Page } from 'playwright';

// ============================================
// Standard Response Types
// ============================================

/**
 * Standard response type for tool results with structured output.
 * Follows MCP best practices for consistent, predictable responses.
 *
 * **Design Principles:**
 * - Always include success flag for programmatic checking
 * - Provide error details with actionable information
 * - Include metadata for debugging and tracing
 * - Keep response structure consistent across all tools
 *
 * @template T - The type of data returned on success
 *
 * @example
 * ```typescript
 * // Success response
 * const response: StandardResponse<{ pageId: string }> = {
 *   success: true,
 *   data: { pageId: 'abc-123' },
 *   metadata: {
 *     timestamp: new Date().toISOString(),
 *     executionTime: 150,
 *     sessionId: 'session-456',
 *   },
 * };
 *
 * // Error response
 * const errorResponse: StandardResponse<never> = {
 *   success: false,
 *   error: {
 *     code: 'ELEMENT_NOT_FOUND',
 *     message: 'Button "Submit" not found',
 *     retryable: true,
 *   },
 *   metadata: { timestamp: new Date().toISOString() },
 * };
 * ```
 */
export interface StandardResponse<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Response data on success */
  data?: T;
  /** Error details on failure */
  error?: {
    /** Error code for programmatic handling */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error context */
    details?: unknown;
    /** Whether the operation can be retried */
    retryable?: boolean;
  };
  /** Response metadata for tracing and debugging */
  metadata: {
    /** ISO timestamp of response */
    timestamp: string;
    /** Execution time in milliseconds */
    executionTime?: number;
    /** Request ID for tracing */
    requestId?: string;
    /** Session ID if applicable */
    sessionId?: string;
    /** Page ID if applicable */
    pageId?: string;
  };
}

/**
 * Result type for web-first assertions.
 * Captures both expected and actual values for clear failure messages.
 *
 * @template T - The type of values being compared
 *
 * @example
 * ```typescript
 * const result: AssertionResult<string> = {
 *   success: false,
 *   expected: 'Welcome, User!',
 *   actual: 'Loading...',
 *   message: 'Text content did not match within 5000ms',
 * };
 * ```
 */
export interface AssertionResult<T> {
  /** Whether the assertion passed */
  success: boolean;
  /** Expected value (for failure messages) */
  expected?: T;
  /** Actual value found (for failure messages) */
  actual?: T;
  /** Descriptive message about the assertion */
  message?: string;
}

// ============================================
// Shared Primitive Types
// ============================================

/**
 * Supported browser engines.
 * Playwright supports all major browser engines for cross-browser testing.
 *
 * @see https://playwright.dev/docs/browsers
 */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Mouse button options for click operations.
 * Maps to standard DOM mouse button values.
 */
export type MouseButton = 'left' | 'middle' | 'right';

/**
 * Keyboard modifiers for combined key presses.
 * Used with click and keyboard operations for modifier keys.
 */
export type KeyModifier = 'Alt' | 'Control' | 'Meta' | 'Shift';

/**
 * Navigation wait conditions.
 * Determines when navigation is considered complete.
 *
 * **Choosing the Right Condition:**
 * - `'load'` - Wait for the load event (all resources loaded). Best for traditional sites.
 * - `'domcontentloaded'` - Wait for DOMContentLoaded event (DOM ready). Best for SPAs.
 * - `'networkidle'` - Wait until no network requests for 500ms. Best for async data loading.
 * - `'commit'` - Wait for navigation to be committed. Fastest, minimal waiting.
 *
 * @see https://playwright.dev/docs/navigations#navigation-lifecycle
 */
export type WaitUntilState =
  | 'load'
  | 'domcontentloaded'
  | 'networkidle'
  | 'commit';

/**
 * Element visibility states for waitForSelector.
 * Controls what state the element must be in.
 *
 * - `'visible'` - Element is visible (has bounding box, not hidden)
 * - `'hidden'` - Element is hidden or not in DOM
 * - `'attached'` - Element exists in DOM (may be hidden)
 * - `'detached'` - Element does not exist in DOM
 */
export type ElementState = 'visible' | 'hidden' | 'attached' | 'detached';

/**
 * Color scheme options for emulateMedia.
 * Used for testing dark/light mode styles.
 *
 * @see https://playwright.dev/docs/emulation#color-scheme-and-media
 */
export type ColorScheme = 'light' | 'dark' | 'no-preference';

/**
 * Reduced motion options for accessibility testing.
 * Important for testing with users who have vestibular disorders.
 *
 * @see https://playwright.dev/docs/emulation#color-scheme-and-media
 */
export type ReducedMotion = 'reduce' | 'no-preference';

/**
 * Forced colors options for accessibility testing.
 * Tests high contrast mode compatibility.
 */
export type ForcedColors = 'active' | 'none';

// ============================================
// Browser Session Types
// ============================================

/**
 * Browser session with context and pages.
 * Sessions are isolated browser instances managed by the server.
 *
 * **Isolation Model:**
 * - Each session has its own browser instance
 * - Each session has one BrowserContext for state isolation
 * - Multiple pages (tabs) can exist within a session
 * - Sessions are identified by UUID
 *
 * @see https://playwright.dev/docs/browser-contexts
 */
export interface BrowserSession {
  /** Unique session identifier (UUID) */
  id: string;
  /** Playwright Browser instance */
  browser: Browser;
  /** Browser context for this session (cookies, storage, etc.) */
  context: BrowserContext;
  /** Map of page IDs to Page instances */
  pages: Map<string, Page>;
  /** Session metadata for management and monitoring */
  metadata: SessionMetadata;
}

/**
 * Session metadata for tracking, monitoring, and management.
 * Updated on every session activity for timeout tracking.
 */
export interface SessionMetadata {
  /** Browser engine type (chromium, firefox, webkit) */
  browserType: BrowserType;
  /** When the session was created */
  launchTime: Date;
  /** Last activity timestamp (updated on every operation) */
  lastActivity: Date;
  /** Whether browser is running headless */
  headless: boolean;
  /** Currently active page ID (for tab management) */
  activePageId?: string;
  /** Custom user agent if set */
  userAgent?: string;
  /** Current viewport dimensions */
  viewport?: Viewport;
}

// ============================================
// Viewport and Position Types
// ============================================

/** Viewport dimensions */
export interface Viewport {
  width: number;
  height: number;
}

/** Coordinate position */
export interface Position {
  x: number;
  y: number;
}

/** Clip region for screenshots */
export interface ClipRegion extends Position {
  width: number;
  height: number;
}

/** Bounding box with all dimensions (x, y, width, height) */
export type BoundingBox = ClipRegion;

// ============================================
// Common Reference Types
// ============================================

/**
 * Common session-page identifier used by most operations.
 * Export for use in handler modules.
 */
export interface SessionPageRef {
  sessionId: string;
  pageId: string;
}

/**
 * Base options for locator operations.
 */
export interface BaseLocatorOptions extends SessionPageRef {
  timeout?: number;
}

// ============================================
// Navigation Options
// ============================================

/** Options for page navigation */
export interface NavigationOptions {
  sessionId: string;
  url: string;
  waitUntil?: WaitUntilState;
  timeout?: number;
  referer?: string;
}

/** Options for waiting on elements */
export interface WaitForSelectorOptions extends SessionPageRef {
  selector: string;
  state?: ElementState;
  timeout?: number;
  strict?: boolean;
}

// ============================================
// Element Interaction Options
// ============================================

/** Options for element click operations */
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

/** Options for element fill operations */
export interface FillOptions extends SessionPageRef {
  selector: string;
  text: string;
  timeout?: number;
  force?: boolean;
  noWaitAfter?: boolean;
}

/** Options for element hover operations */
export interface HoverOptions extends SessionPageRef {
  selector: string;
  timeout?: number;
  force?: boolean;
  position?: Position;
  modifiers?: KeyModifier[];
  trial?: boolean;
}

// ============================================
// Screenshot Options
// ============================================

/** Options for taking screenshots */
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

// ============================================
// ARIA Roles - Comprehensive List for Accessibility
// ============================================

/**
 * Complete list of ARIA roles for semantic locators.
 * Organized by category following WAI-ARIA specification.
 *
 * **Role Categories:**
 *
 * **Widget Roles** (Interactive elements):
 * - `button`, `checkbox`, `link`, `textbox`, `radio`, `slider`, `switch`, `tab`
 * - Used for interactive UI components
 *
 * **Document Structure Roles**:
 * - `heading`, `article`, `list`, `listitem`, `table`, `row`, `cell`
 * - Used for content organization
 *
 * **Landmark Roles**:
 * - `banner`, `main`, `navigation`, `complementary`, `contentinfo`, `search`
 * - Used for page regions (accessibility navigation)
 *
 * **Live Region Roles**:
 * - `alert`, `status`, `log`, `timer`
 * - Used for dynamic content updates
 *
 * @see https://www.w3.org/TR/wai-aria-1.2/#roles
 * @see https://playwright.dev/docs/api/class-locator#locator-get-by-role
 *
 * @example
 * ```typescript
 * // Click a button by role and accessible name
 * await page.getByRole('button', { name: 'Submit' }).click();
 *
 * // Fill a textbox
 * await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com');
 *
 * // Check a checkbox
 * await page.getByRole('checkbox', { name: 'Accept terms' }).check();
 *
 * // Click a specific heading level
 * await page.getByRole('heading', { level: 2, name: 'Features' }).click();
 * ```
 */
export const ARIA_ROLES = [
  // Widget roles (interactive elements)
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
  // Landmark roles (page regions)
  'application',
  'banner',
  'complementary',
  'contentinfo',
  'form',
  'main',
  'navigation',
  'region',
  'search',
  // Live region roles (dynamic content)
  'alert',
  'alertdialog',
  'dialog',
  'log',
  'marquee',
  'status',
  'timer',
  // Composite roles (containers)
  'grid',
  'radiogroup',
  'tablist',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
] as const;

/** Type for valid ARIA roles */
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
