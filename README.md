# MCP Playwright Server

A comprehensive Model Context Protocol (MCP) server for browser automation using Playwright. This server enables AI assistants like Claude and GitHub Copilot to control web browsers programmatically.

## Features

- **Multi-Browser Support**: Chromium, Firefox, and WebKit
- **Session Management**: Handle multiple browser sessions simultaneously
- **Complete Browser Control**: Navigate, click, fill, hover, screenshot, and execute scripts
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

### Element Interaction (CSS Selectors)

| Tool             | Description                            |
| ---------------- | -------------------------------------- |
| `element_click`  | Click on an element using CSS selector |
| `element_fill`   | Fill text into an input field          |
| `element_hover`  | Hover over an element                  |
| `element_select` | Select option from dropdown            |
| `element_check`  | Check/uncheck checkbox or radio        |

### Role-Based Locators (Recommended)

| Tool                  | Description                                     |
| --------------------- | ----------------------------------------------- |
| `click_by_role`       | Click element by ARIA role (button, link, etc.) |
| `click_by_text`       | Click element by visible text                   |
| `click_by_testid`     | Click element by data-testid                    |
| `fill_by_label`       | Fill input by associated label                  |
| `fill_by_placeholder` | Fill input by placeholder text                  |
| `fill_by_testid`      | Fill input by data-testid                       |

### Web-First Assertions

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

### Frame/Iframe Support

| Tool          | Description                 |
| ------------- | --------------------------- |
| `frame_click` | Click element inside iframe |
| `frame_fill`  | Fill input inside iframe    |

### Advanced Features

| Tool                | Description                          |
| ------------------- | ------------------------------------ |
| `drag_and_drop`     | Drag element to another element      |
| `wait_for_selector` | Wait for element to appear/disappear |
| `wait_for_download` | Wait for file download               |
| `page_screenshot`   | Take a screenshot                    |
| `page_content`      | Get page HTML and text               |
| `execute_script`    | Run JavaScript in page context       |

### Keyboard & Mouse

| Tool             | Description                      |
| ---------------- | -------------------------------- |
| `keyboard_press` | Press a key or key combination   |
| `keyboard_type`  | Type text character by character |
| `mouse_move`     | Move mouse to coordinates        |
| `mouse_click`    | Click at coordinates             |

### Network & Tracing

| Tool              | Description                         |
| ----------------- | ----------------------------------- |
| `network_route`   | Intercept and mock network requests |
| `network_unroute` | Remove network routes               |
| `tracing_start`   | Start recording a trace             |
| `tracing_stop`    | Stop and save trace                 |

### Authentication

| Tool                 | Description                              |
| -------------------- | ---------------------------------------- |
| `save_storage_state` | Save cookies/localStorage for auth reuse |
| `launch_with_auth`   | Launch browser with saved auth state     |

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

### Fill Form

```txt
User: "Fill the email field with test@example.com"

The AI will:
1. Call element_fill with selector 'input[type="email"]' and text
2. Confirm the action was completed
```

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
