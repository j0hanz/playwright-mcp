# MCP Playwright Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)[![Playwright](https://img.shields.io/badge/Playwright-1.52+-green.svg)](https://playwright.dev/)[![MCP](https://img.shields.io/badge/MCP-1.0-purple.svg)](https://modelcontextprotocol.io/)[![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen.svg)](https://nodejs.org/)[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A comprehensive **Model Context Protocol (MCP) server** for browser automation using Playwright. This server enables AI assistants to control browsers via the MCP protocol, providing powerful tools for web testing, accessibility audits, and browser automation.

## Features

- 🌐 **Multi-Browser Support** - Chromium, Firefox, and WebKit
- 🔧 **50+ Browser Automation Tools** - Navigation, interaction, assertions, screenshots
- ♿ **Accessibility Testing** - Built-in axe-core integration with WCAG compliance checks
- 🔒 **Session Management** - Isolated browser contexts with rate limiting
- 📸 **Visual Testing** - Screenshots, video recording, and tracing
- 🧪 **AI Test Agents** - Automated test planning, generation, and healing

## Technology Stack

| Category               | Technologies                     |
| ---------------------- | -------------------------------- |
| **Runtime**            | Node.js 18+                      |
| **Language**           | TypeScript 5.8                   |
| **Browser Automation** | Playwright 1.52+                 |
| **Protocol**           | Model Context Protocol (MCP) SDK |
| **Validation**         | Zod                              |
| **Accessibility**      | @axe-core/playwright             |
| **Logging**            | Winston                          |
| **Testing**            | @playwright/test                 |
| **Linting**            | ESLint 9, Prettier               |

## Architecture

```text
AI Client → MCP Protocol → Tool Handler → BrowserManager → Action Module → Playwright API
                                ↑
                         SessionManager (lifecycle, rate limiting)
```

### Layer Responsibilities

| Layer           | Location                            | Purpose                                     |
| --------------- | ----------------------------------- | ------------------------------------------- |
| Entry           | `src/index.ts`                      | Bootstrap, graceful shutdown                |
| MCP Server      | `src/server/mcp-server.ts`          | Tool/resource registration, session cleanup |
| Handlers        | `src/server/handlers/`              | Tool definitions grouped by category        |
| Browser Manager | `src/playwright/browser-manager.ts` | Orchestrates action modules                 |
| Actions         | `src/playwright/actions/`           | Domain-specific Playwright operations       |
| Session Manager | `src/playwright/session-manager.ts` | Session/page lifecycle, rate limiting       |

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/j0hanz/playwright-mcp.git
cd playwright-mcp

# Install dependencies
npm install

# Install Playwright browsers
npm run install:browsers
```

### Configuration

Create a `.env` file in the project root (optional):

```env
LOG_LEVEL=info              # debug, info, warn, error
DEFAULT_BROWSER=chromium    # chromium, firefox, webkit
HEADLESS=true               # Run headless mode
MAX_SESSIONS=5              # Concurrent sessions (1-20)
SESSION_TIMEOUT=1800000     # Session expiry in ms (30 min)
TIMEOUT_ACTION=20000        # Element action timeout in ms
TIMEOUT_NAVIGATION=30000    # Page navigation timeout in ms
```

### Running the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production build and run
npm run build
npm start
```

## Project Structure

```text
├── src/
│   ├── index.ts                    # Application entry point
│   ├── config/
│   │   ├── server-config.ts        # Environment configuration
│   │   └── types.ts                # TypeScript type definitions
│   ├── server/
│   │   ├── mcp-server.ts           # MCP server implementation
│   │   └── handlers/               # Tool handler categories
│   │       ├── browser-tools.ts    # Browser lifecycle tools
│   │       ├── navigation-tools.ts # Navigation tools
│   │       ├── interaction-tools.ts# Click, fill, hover tools
│   │       ├── assertion-tools.ts  # Web-first assertions
│   │       ├── page-tools.ts       # Screenshots, content, a11y
│   │       ├── test-tools.ts       # Test file management
│   │       ├── advanced-tools.ts   # Network, tracing, dialogs
│   │       └── schemas.ts          # Zod validation schemas
│   ├── playwright/
│   │   ├── browser-manager.ts      # Central browser orchestration
│   │   ├── session-manager.ts      # Session lifecycle
│   │   ├── browser-launcher.ts     # Browser launch logic
│   │   └── actions/                # Domain-specific actions
│   │       ├── assertion-actions.ts
│   │       ├── interaction-actions.ts
│   │       ├── navigation-actions.ts
│   │       └── ...
│   └── utils/
│       ├── error-handler.ts        # Centralized error handling
│       └── logger.ts               # Winston logger
├── tests/                          # Playwright test files
├── specs/                          # Human-readable test plans
├── .github/
│   ├── agents/                     # AI agent definitions
│   ├── prompts/                    # Agent prompts
│   └── copilot-instructions.md     # Development guidelines
└── playwright.config.ts            # Playwright test configuration
```

## Available Tools

### Browser Lifecycle

| Tool                  | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `browser_launch`      | Launch browser (Chromium, Firefox, WebKit) with optional auth state |
| `browser_close`       | Close browser session                                               |
| `browser_tabs`        | List, create, close, or select browser tabs                         |
| `sessions_list`       | List all active browser sessions                                    |
| `save_storage_state`  | Save cookies/localStorage for auth reuse                            |
| `session_reset_state` | Clear session data for test isolation                               |

### Navigation

| Tool               | Description                    |
| ------------------ | ------------------------------ |
| `browser_navigate` | Navigate to URL                |
| `browser_history`  | Go back/forward in history     |
| `browser_reload`   | Reload current page            |
| `handle_dialog`    | Accept/dismiss browser dialogs |

### Interaction

| Tool             | Description                                    |
| ---------------- | ---------------------------------------------- |
| `element_click`  | Click by role, text, testid, or selector       |
| `element_fill`   | Fill inputs by label, placeholder, or selector |
| `element_hover`  | Hover over elements                            |
| `select_option`  | Select dropdown options                        |
| `keyboard_press` | Press keys (Enter, Tab, shortcuts)             |
| `keyboard_type`  | Type text character by character               |
| `checkbox_set`   | Check/uncheck checkboxes                       |
| `file_upload`    | Upload files                                   |
| `drag_and_drop`  | Drag and drop elements                         |

### Assertions

| Tool               | Description                                       |
| ------------------ | ------------------------------------------------- |
| `assert_element`   | Assert state (visible, hidden, enabled, disabled) |
| `assert_text`      | Assert element text content                       |
| `assert_value`     | Assert input value                                |
| `assert_url`       | Assert page URL                                   |
| `assert_title`     | Assert page title                                 |
| `assert_attribute` | Assert element attribute                          |
| `assert_css`       | Assert CSS property                               |
| `assert_checked`   | Assert checkbox state                             |
| `assert_count`     | Assert element count                              |

### Page Operations

| Tool                       | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `page_screenshot`          | Capture screenshots (full page, element, region) |
| `page_pdf`                 | Generate PDF from page (Chromium only)           |
| `page_content`             | Get HTML and text content                        |
| `page_evaluate`            | Execute JavaScript (read-only)                   |
| `wait_for_selector`        | Wait for elements                                |
| `page_wait_for_load_state` | Wait for page load                               |
| `accessibility_scan`       | Run axe-core accessibility audit                 |
| `browser_snapshot`         | Get accessibility tree snapshot                  |

### Cookie Management

| Tool            | Description                           |
| --------------- | ------------------------------------- |
| `cookies_get`   | Retrieve cookies from browser context |
| `cookies_set`   | Add cookies (auth tokens, sessions)   |
| `cookies_clear` | Clear all or specific cookies         |

### Advanced

| Tool                             | Description              |
| -------------------------------- | ------------------------ |
| `network_mock`                   | Mock network responses   |
| `network_unroute`                | Remove network mocks     |
| `tracing_start` / `tracing_stop` | Record execution traces  |
| `console_capture`                | Capture console messages |
| `har_record_start`               | Record HTTP archive      |
| `clock_install`                  | Control time in tests    |
| `video_path`                     | Get video recording path |

## Best Practices for Stable Tests

Following these practices will ensure your tests are resilient, maintainable, and less prone to flakiness. See the full [Best Practices Guide](./docs/best-practices.md) for detailed examples.

### Core Principles

1. **Use Semantic, User-Facing Locators**
   - Role-based locators are most reliable: `getByRole('button', { name: 'Submit' })`
   - Avoid CSS selectors and XPath — these break when styling changes
   - Priority: Role → Label → Placeholder → Text → TestId → CSS (last resort)

2. **Use Locator Chaining and Filtering**
   - Chain locators to narrow searches: `page.getByRole('listitem').filter({ hasText: 'Product 2' })`
   - Filter by text or other locators for dynamic content
   - This reduces strict mode violations and increases clarity

3. **Always Use Web-First Assertions**
   - Use `expect()` assertions which auto-wait: `await expect(page.getByText('Success')).toBeVisible()`
   - Don't use direct checks like `isVisible()` without expect
   - Assertions wait up to 5 seconds (configurable) before failing

4. **Avoid Common Pitfalls**
   - ❌ `waitForTimeout()` — use specific waits instead
   - ❌ `waitForLoadState('networkidle')` — use `'domcontentloaded'` or wait for elements
   - ❌ CSS class selectors — use role/label/text locators
   - ❌ Screenshots as selectors — use `browser_snapshot` for finding elements
   - ❌ `test.only()` or `test.skip()` — remove before committing

### Example: Good Test Structure

```typescript
test('Add todo and verify', async ({ page }) => {
  // Navigate
  await page.goto('/');

  // Get accessibility snapshot to understand page structure
  const snapshot = await page.accessibility.snapshot();

  // Interact using semantic locators (role > label > text)
  await page.getByPlaceholder('What needs to be done?').fill('Buy groceries');
  await page.getByRole('button', { name: 'Add' }).click();

  // Verify using web-first assertions (auto-wait)
  await expect(page.getByText('Buy groceries')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(1);
});
```

## Locator Priority

When interacting with elements, prefer user-facing locators (most reliable first):

1. **Role** ⭐ - `element_click(locatorType: 'role', role: 'button', name: 'Submit')`
2. **Label** ⭐ - `element_fill(locatorType: 'label', value: 'Email', text: '...')`
3. **Text** - `element_click(locatorType: 'text', value: 'Learn more')`
4. **Placeholder** - `element_fill(locatorType: 'placeholder', value: 'Search...')`
5. **TestId** - `element_click(locatorType: 'testid', value: 'submit-btn')`
6. **Selector** - CSS selector (last resort only)

## Development Workflow

```bash
# Watch mode with hot reload
npm run dev

# Build TypeScript to dist/
npm run build

# Run ESLint
npm run lint
npm run lint:fix

# Type check without emit
npm run type-check

# Format with Prettier
npm run format

# Run tests
npm test
npm run test:ui      # Interactive UI
npm run test:headed  # Visible browser
npm run test:debug   # Debug mode
```

**Before committing:** Run `npm run lint && npm run type-check && npm run build`

## Coding Standards

### Tool Registration Pattern

```typescript
server.registerTool(
  'tool_name',
  {
    title: 'Human Title',
    description: 'What this tool does',
    inputSchema: {
      /* Zod schemas */
    },
    outputSchema: {
      /* Result shape */
    },
  },
  createToolHandler(async (input) => {
    const result = await browserManager.someMethod(input);
    return {
      content: [{ type: 'text', text: 'Human readable' }],
      structuredContent: result, // Machine readable
    };
  }, 'Error prefix message')
);
```

### Action Module Pattern

```typescript
export class MyActions extends BaseAction {
  async myOperation(sessionId: string, pageId: string, options: Options) {
    return this.executePageOperation(
      sessionId,
      pageId,
      'My operation',
      async (page) => {
        // Playwright operations
        return { success: true, data: '...' };
      }
    );
  }
}
```

### Error Handling

```typescript
import {
  ErrorCode,
  ErrorHandler,
  validateUUID,
} from '../utils/error-handler.js';

validateUUID(sessionId, 'sessionId'); // Throws on invalid
throw ErrorHandler.sessionNotFound(id); // Factory methods
throw ErrorHandler.handlePlaywrightError(e); // Maps Playwright errors
```

## Testing

Tests use `@playwright/test` framework. Configuration is in `playwright.config.ts`.

```bash
npm test                 # Run all tests
npm run test:ui          # Interactive test UI
npm run test:headed      # With visible browser
npm run test:debug       # Debug mode with inspector
npm run test:trace       # Record traces
npm run test:report      # Show HTML report
```

### Test Configuration

- **Timeout**: 30 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Viewport**: 1366x900
- **Test ID Attribute**: `data-testid`

## AI Test Agents

Three AI agents for automated test workflows:

| Agent         | Input               | Output                  |
| ------------- | ------------------- | ----------------------- |
| **Planner**   | App URL + seed test | `specs/*.md` test plans |
| **Generator** | Test plan           | `tests/*.spec.ts` files |
| **Healer**    | Failing test        | Fixed test file         |

### Usage

1. **Planner**: Explore app and create test plans in `specs/`
2. **Generator**: Transform plans into Playwright tests
3. **Healer**: Debug and fix failing tests

Agent definitions are in `.github/agents/` with prompts in `.github/prompts/`.

## Security

- **URL validation**: Only `http://` and `https://` protocols allowed
- **UUID validation**: All session/page IDs validated
- **Rate limiting**: Configurable `MAX_SESSIONS_PER_MINUTE`
- **Session isolation**: Each browser context is isolated
- **Script restrictions**: Only safe, read-only JavaScript evaluation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the coding standards in `.github/copilot-instructions.md`
4. Run linting and type checking (`npm run lint && npm run type-check`)
5. Ensure tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Adding a New Tool

1. Add method to action class in `src/playwright/actions/`
2. Register in handler file in `src/server/handlers/`
3. Add schemas to `schemas.ts` if new input shapes needed
4. Add tests for the new functionality

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Playwright](https://playwright.dev/) - Browser automation framework
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI assistant protocol
- [axe-core](https://github.com/dequelabs/axe-core) - Accessibility testing engine
