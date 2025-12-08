# Integration Tests Quick Start

## 🚀 Quick Commands

### Run All Integration Tests

```powershell
npx playwright test tests/integration/
```

### Run with UI Mode (Best for Development)

```powershell
npx playwright test tests/integration/ --ui
```

### Run Specific Test File

```powershell
# Browser lifecycle (launch, tabs, storage)
npx playwright test tests/integration/browser-lifecycle.spec.ts

# Navigation (URLs, history, dialogs)
npx playwright test tests/integration/navigation.spec.ts

# Interactions (click, type, drag, upload)
npx playwright test tests/integration/interactions.spec.ts

# Assertions (verify element state, content)
npx playwright test tests/integration/assertions.spec.ts

# Page operations (screenshots, evaluate)
npx playwright test tests/integration/page-operations.spec.ts

# Network (mocking, interception)
npx playwright test tests/integration/network.spec.ts

# Accessibility (WCAG compliance)
npx playwright test tests/integration/accessibility.spec.ts
```

### Run on Specific Browser

```powershell
npx playwright test tests/integration/ --project=chromium
npx playwright test tests/integration/ --project=firefox
npx playwright test tests/integration/ --project=webkit
npx playwright test tests/integration/ --project="Mobile Chrome"
```

### Debug Failing Tests

```powershell
# Debug mode with inspector
npx playwright test tests/integration/assertions.spec.ts --debug

# Run with visible browser
npx playwright test tests/integration/ --headed

# Run specific test by name
npx playwright test tests/integration/browser-lifecycle.spec.ts -g "multiple tabs"
```

## 📊 Test Coverage

**Total: 242 tests across 7 files**

| Category          | Tests | Description                                 |
| ----------------- | ----- | ------------------------------------------- |
| Browser Lifecycle | 26    | Launch, close, tabs, storage, configuration |
| Navigation        | 26    | URLs, history, reload, dialogs, errors      |
| Interactions      | 43    | Click, type, hover, drag, file upload       |
| Assertions        | 60    | Element state, content, attributes, CSS     |
| Page Operations   | 51    | Screenshots, evaluate, waits, content       |
| Network           | 33    | Mocking, blocking, interception, HAR        |
| Accessibility     | 19    | A11y scanning, WCAG, keyboard nav           |

## 🌐 Test Sites

- **example.com** - Stable baseline for basic tests
- **httpbin.org** - HTTP testing (currently down)
- **the-internet.herokuapp.com** - Comprehensive UI testing
- **developer.mozilla.org** - Complex navigation, accessibility

## ✅ Current Status

**Verified Working:**

- ✅ Browser lifecycle: 8/8 tests (100%)
- ✅ Navigation: 15/26 tests (58%)
- ⚠️ Assertions: 39/60 tests (65%)

**Not Yet Run:**

- 📋 Interactions: 43 tests ready
- 📋 Page operations: 51 tests ready
- 📋 Network: 33 tests ready
- 📋 Accessibility: 19 tests ready

## 📝 MCP Tools Covered

### ✅ Fully Tested

- `browser_launch` - Launch browsers
- `browser_close` - Close sessions
- `browser_tabs` - Manage tabs
- `browser_navigate` - Navigate URLs
- `browser_history` - Back/forward
- `browser_reload` - Reload pages
- `handle_dialog` - Dialog handling
- `save_storage_state` - Persist auth
- `session_reset_state` - Clear state
- `page_prepare` - Configure page

### 📋 Ready to Test

- `element_click` - Click elements
- `element_fill` - Fill inputs
- `element_hover` - Hover actions
- `select_option` - Dropdowns
- `checkbox_set` - Checkboxes
- `keyboard_press` - Keyboard input
- `drag_and_drop` - Drag actions
- `file_upload` - Upload files
- `page_screenshot` - Screenshots
- `page_evaluate` - Run JavaScript
- `wait_for_selector` - Wait for elements
- `network_route` - Mock requests
- `accessibility_scan` - A11y checks
- And 30+ more...

## 🛠️ Useful Commands

### View HTML Report

```powershell
npx playwright show-report
```

### Run with Trace

```powershell
npx playwright test tests/integration/ --trace on
```

### Run with Maximum Failures

```powershell
npx playwright test tests/integration/ --max-failures=5
```

### Run Single Worker (Sequential)

```powershell
npx playwright test tests/integration/ --workers=1
```

### Update Snapshots

```powershell
npx playwright test tests/integration/ --update-snapshots
```

## 📚 Documentation

- **Full Guide**: `tests/integration/README.md`
- **Test Results**: `tests/integration/TEST-RESULTS.md`
- **Best Practices**: `docs/best-practices.md`
- **Playwright Docs**: https://playwright.dev

## 🎯 Next Steps

1. **Run all tests**: `npx playwright test tests/integration/`
2. **Fix known issues** (strict mode, external sites)
3. **Add more edge cases**
4. **Create custom fixtures**
5. **Set up CI/CD**

## 💡 Tips

- Use `--ui` mode for best debugging experience
- Use semantic locators (role > label > text)
- Rely on web-first assertions (auto-waiting)
- Avoid `waitForTimeout` - use specific waits
- Keep tests independent and idempotent

---

🎉 Ready to test! Run `npx playwright test tests/integration/ --ui`
