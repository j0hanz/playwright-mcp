# MCP Playwright Server

A comprehensive Model Context Protocol (MCP) server for browser automation using Playwright. This server enables AI assistants like Claude and GitHub Copilot to control web browsers programmatically.

## Features

- **Multi-Browser Support**: Chromium, Firefox, and WebKit
- **Session Management**: Handle multiple browser sessions simultaneously
- **User-Facing Locators**: Role-based, label-based, and text-based locators (Playwright best practices)
- **Web-First Assertions**: Auto-waiting assertions for reliable testing
- **Accessibility Testing**: Built-in axe-core integration for WCAG compliance
- **Structured Responses**: Consistent JSON responses with timing and metadata
- **Robust Error Handling**: Comprehensive error types with retry logic
- **TypeScript**: Fully typed with Zod schema validation

## Quick Start

### Installation

```bash
cd .github/mcp-playwright-server
npm install
npx playwright install
```

### Build

```bash
npm run build
```

### Run

```bash
npm start
```

### Development

```bash
npm run dev
```

## Available Tools

### Browser Management

| Tool                    | Description                         |
| ----------------------- | ----------------------------------- |
| `browser_launch`        | Launch a new browser instance       |
| `browser_navigate`      | Navigate to a URL                   |
| `browser_navigate_back` | Go back in browser history          |
| `browser_resize`        | Resize the browser viewport         |
| `browser_tabs`          | List, create, close, or select tabs |
| `browser_handle_dialog` | Accept or dismiss dialogs           |
| `browser_file_upload`   | Upload files to file inputs         |
| `browser_close`         | Close a browser session             |
| `sessions_list`         | List all active browser sessions    |

### Role-Based Locators (Recommended)

These tools follow Playwright's recommended locator hierarchy for stable, user-facing automation:

| Tool                  | Description                                     | Priority |
| --------------------- | ----------------------------------------------- | -------- |
| `click_by_role`       | Click element by ARIA role (button, link, etc.) | ⭐ Best  |
| `fill_by_label`       | Fill input by associated label                  | ⭐ Best  |
| `click_by_text`       | Click element by visible text                   | Good     |
| `fill_by_placeholder` | Fill input by placeholder text                  | Good     |
| `click_by_testid`     | Click element by data-testid                    | Fallback |
| `fill_by_testid`      | Fill input by data-testid                       | Fallback |
| `click_by_alt_text`   | Click image by alt text                         | Specific |

> **Best Practice**: Always prefer role-based and label-based locators over CSS selectors. They are more resilient to DOM changes and reflect how users interact with the UI.

### Web-First Assertions

Auto-waiting assertions that retry until the condition is met:

| Tool               | Description                          |
| ------------------ | ------------------------------------ |
| `assert_visible`   | Assert element is visible            |
| `assert_hidden`    | Assert element is hidden             |
| `assert_text`      | Assert element has/contains text     |
| `assert_attribute` | Assert element has attribute value   |
| `assert_value`     | Assert input has value               |
| `assert_checked`   | Assert checkbox is checked/unchecked |
| `assert_url`       | Assert page URL                      |
| `assert_title`     | Assert page title                    |

### Wait & Load State

| Tool                       | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `wait_for_selector`        | Wait for element to appear/disappear                           |
| `wait_for_download`        | Wait for file download                                         |
| `page_wait_for_load_state` | Wait for page load state (load, domcontentloaded, networkidle) |
| `wait_for_network_idle`    | Wait until no network requests for 500ms                       |

### Page Inspection

| Tool              | Description                         |
| ----------------- | ----------------------------------- |
| `page_screenshot` | Take a screenshot                   |
| `page_content`    | Get page HTML and text              |
| `page_prepare`    | Configure page settings for testing |

### Keyboard & Mouse

| Tool             | Description                      |
| ---------------- | -------------------------------- |
| `keyboard_press` | Press a key or key combination   |
| `keyboard_type`  | Type text character by character |
| `mouse_move`     | Move mouse to coordinates        |
| `mouse_click`    | Click at coordinates             |

### Tracing & Debugging

| Tool            | Description             |
| --------------- | ----------------------- |
| `tracing_start` | Start recording a trace |
| `tracing_stop`  | Stop and save trace     |

### Authentication

| Tool                  | Description                              |
| --------------------- | ---------------------------------------- |
| `save_storage_state`  | Save cookies/localStorage for auth reuse |
| `launch_with_auth`    | Launch browser with saved auth state     |
| `session_reset_state` | Clear session cookies and storage        |

### Accessibility Testing

| Tool                     | Description                                  |
| ------------------------ | -------------------------------------------- |
| `accessibility_scan`     | Scan page for WCAG violations using axe-core |
| `accessibility_report`   | Generate HTML accessibility report           |
| `emulate_reduced_motion` | Test reduced motion preference               |
| `emulate_color_scheme`   | Test light/dark color scheme                 |

## Locator Priority Guide

When automating browser interactions, use locators in this priority order:

```text
1. getByRole()       ← Buttons, links, headings, form elements (MOST PREFERRED)
2. getByLabel()      ← Form inputs with labels
3. getByPlaceholder  ← Inputs with placeholder text
4. getByTestId()     ← When semantic locators aren't suitable
5. getByText()       ← Unique visible text content
❌ CSS/XPath         ← AVOID - brittle, breaks with UI changes
```

### Example: Filling a Login Form

```txt
User: "Log in with email test@example.com and password secret123"

The AI will use role-based locators:
1. Call fill_by_label with label "Email" and text "test@example.com"
2. Call fill_by_label with label "Password" and text "secret123"
3. Call click_by_role with role "button" and name "Sign in"
4. Call assert_url to verify redirect to dashboard
```

## Configuration

### VS Code / Copilot

Add to your VS Code settings or `.vscode/settings.json`:

```json
{
  "mcp": {
    "servers": {
      "playwright-custom": {
        "command": "node",
        "args": [".github/mcp-playwright-server/dist/index.js"],
        "env": {
          "LOG_LEVEL": "info",
          "HEADLESS": "true"
        }
      }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": ["/path/to/.github/mcp-playwright-server/dist/index.js"],
      "env": {
        "LOG_LEVEL": "info",
        "HEADLESS": "true"
      }
    }
  }
}
```

## Environment Variables

| Variable          | Default  | Description                              |
| ----------------- | -------- | ---------------------------------------- |
| `LOG_LEVEL`       | info     | Logging level (debug, info, warn, error) |
| `DEFAULT_BROWSER` | chromium | Default browser type                     |
| `HEADLESS`        | true     | Run browsers in headless mode            |
| `VIEWPORT_WIDTH`  | 1920     | Default viewport width                   |
| `VIEWPORT_HEIGHT` | 1080     | Default viewport height                  |
| `MAX_SESSIONS`    | 5        | Maximum concurrent browser sessions      |
| `SESSION_TIMEOUT` | 1800000  | Session timeout in milliseconds          |
| `TIMEOUT_DEFAULT` | 30000    | Default operation timeout                |

## Usage Examples

### Launch Browser and Navigate

```txt
User: "Open https://example.com in a browser"

The AI will:
1. Call browser_launch to start a browser
2. Call browser_navigate with the URL
3. Return page information
```

### Take Screenshot

```txt
User: "Take a screenshot of the current page"

The AI will:
1. Call page_screenshot with sessionId and pageId
2. Return the screenshot as base64 image
```

### Fill Form (Using Best Practices)

```txt
User: "Fill the email field with test@example.com"

The AI will:
1. Call fill_by_label with label "Email" and text "test@example.com"
   (or fill_by_placeholder if no label is available)
2. Confirm the action was completed
```

## Security Considerations

This MCP server follows security best practices:

- **User-Facing Locators Only**: CSS-selector-based tools have been removed to encourage resilient, user-facing locators
- **No Arbitrary Script Execution**: The `execute_script` tool has been removed to prevent code injection vulnerabilities
- **No Network Interception**: Network routing tools have been removed to reduce complexity and attack surface
- **URL Validation**: Only `http:` and `https:` protocols are allowed for navigation
- **File Upload Restrictions**: Files must be in the designated `uploads/` directory
- **Session Isolation**: Each browser session is isolated with configurable timeouts

## Running Tests

Run the portfolio test suite:

```bash
npm test
```

Run with UI:

```bash
npm run test:ui
```

## Docker

Build and run with Docker:

```bash
docker build -t mcp-playwright .
docker run -p 3000:3000 mcp-playwright
```

## Project Structure

```txt
mcp-playwright-server/
├── src/
│   ├── config/
│   │   └── server-config.ts    # Server configuration
│   ├── playwright/
│   │   └── browser-manager.ts  # Playwright browser management
│   ├── server/
│   │   └── mcp-server.ts       # MCP server with tools
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── utils/
│   │   ├── error-handler.ts    # Error handling
│   │   ├── logger.ts           # Logging utility
│   │   ├── response-formatter.ts # Response formatting
│   │   └── validation.ts       # Zod schemas
│   └── index.ts                # Entry point
├── tests/
│   └── portfolio.test.ts       # Portfolio-specific tests
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

## License

MIT
