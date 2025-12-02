# VS Code + Playwright MCP Integration Guide

This guide shows how to integrate the Playwright MCP server with VS Code and use AI-assisted test generation.

## Table of Contents

- [Setup](#setup)
- [Using the Playwright Agent](#using-the-playwright-agent)
- [Test Planning Workflow](#test-planning-workflow)
- [Test Generation Workflow](#test-generation-workflow)
- [Test Healing Workflow](#test-healing-workflow)
- [Sample Prompts](#sample-prompts)
- [Tips & Tricks](#tips--tricks)

---

## Setup

### Prerequisites

1. **VS Code** with GitHub Copilot extension
2. **MCP Server** - The Playwright MCP server running locally
3. **Playwright** - Installed in your project (`npm install -D @playwright/test`)
4. **Development server** - Your app running on localhost (e.g., `http://localhost:3000`)

### Configuration

1. Ensure the Playwright MCP server is running:

   ```bash
   npm run dev
   ```

2. Configure your development server in `playwright.config.ts`:

   ```typescript
   webServer: {
     command: 'npm run dev', // Your dev server command
     url: 'http://localhost:3000',
     reuseExistingServer: true,
   },
   ```

3. Start your app in one terminal:

   ```bash
   npm run dev  # or yarn dev
   ```

---

## Using the Playwright Agent

### Opening the Agent

1. Open VS Code Command Palette: `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: "Agent: Playwright" or search for the agent
3. The agent will launch with access to:
   - Browser automation via Playwright MCP
   - File system access
   - Your workspace context

### Agent Capabilities

The Playwright agent can:

- ✅ Launch browsers and navigate to your app
- ✅ Explore page structure using accessibility snapshots
- ✅ Interact with elements using semantic locators
- ✅ Create test plans in Markdown format
- ✅ Generate Playwright test files
- ✅ Analyze and fix failing tests
- ✅ Search documentation and examples

---

## Test Planning Workflow

### Step 1: Launch the Agent

Open the Playwright agent and provide the app URL:

```text
I need to create a test plan for the login page at http://localhost:3000/login
```

### Step 2: Agent Exploration

The agent will:

1. Launch a browser session
2. Navigate to your app
3. Take an accessibility snapshot to understand the page structure
4. Identify interactive elements and user flows
5. Create a comprehensive test plan

### Step 3: Review the Plan

The agent saves a test plan to `specs/[feature]-test-plan.md`. Review and edit if needed:

```markdown
# Login Test Plan

## Overview

Test the login functionality for authenticated users

## Test Scenarios

### 1. Successful Login

**Steps:**

1. Navigate to login page
2. Enter valid email in email field
3. Enter valid password in password field
4. Click "Sign In" button

**Expected Results:**

- Redirected to dashboard
- User name displayed
- Session stored
```

---

## Test Generation Workflow

### Step 1: Prepare the Test Plan

Ensure you have a test plan in `specs/` directory (created by the Planner agent or manually written).

### Step 2: Request Test Generation

Ask the Playwright agent to generate tests:

```text
Generate Playwright tests from the plan in specs/login-test-plan.md
```

### Step 3: Agent Generation Process

The agent will:

1. Read the test plan
2. Launch a browser
3. Execute each step from the plan
4. Verify selectors work live
5. Generate TypeScript test file
6. Close the browser

### Step 4: Review Generated Tests

Generated tests are saved to `tests/[category]/[scenario].spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
  });

  test('successful login', async ({ page }) => {
    // 1. Enter valid email
    await page.getByLabel('Email').fill('user@example.com');

    // 2. Enter valid password
    await page.getByLabel('Password').fill('SecurePass123!');

    // 3. Click sign in button
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify: Redirected to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome, User')).toBeVisible();
  });
});
```

### Step 5: Run and Verify

Run the generated tests:

```bash
npm test
```

If tests fail, proceed to the Healing workflow.

---

## Test Healing Workflow

### When Tests Fail

If a test fails after being generated, ask the Playwright agent to heal it:

```text
The test `tests/login/successful-login.spec.ts` is failing with:
"Error: ELEMENT_NOT_FOUND - button with name 'Sign In' not found"

Please fix this test.
```

### What the Agent Does

The Healer agent will:

1. Replay the failing test
2. Capture a snapshot at the failure point
3. Inspect the current page structure
4. Identify what changed (selector, layout, etc.)
5. Update the test with corrected locators
6. Re-run to verify the fix

### Root Cause Analysis

Common issues and fixes:

| Issue              | Root Cause                          | Agent's Fix                          |
| ------------------ | ----------------------------------- | ------------------------------------ |
| Element not found  | Selector changed or element removed | Use more specific accessible locator |
| Strict mode error  | Multiple matching elements          | Use filtering to narrow selection    |
| Timeout            | Page loads slowly                   | Add explicit wait condition          |
| Assertion mismatch | Dynamic content                     | Use regex or flexible matching       |

---

## Sample Prompts

### Planning Prompts

```text
1. Basic planning:
   "Create a test plan for the authentication flow starting at http://localhost:3000/auth"

2. Specific feature:
   "I need comprehensive test scenarios for the shopping cart checkout process"

3. Error scenarios:
   "Generate test plans for form validation errors on the registration page"

4. Complex flow:
   "Create test scenarios for the multi-step product order workflow including payment"
```

### Generation Prompts

```text
1. Generate from plan:
   "Generate Playwright tests from the plan in specs/checkout-test-plan.md"

2. Specific scenarios:
   "Generate tests only for the success and error cases from specs/login-test-plan.md"

3. Retry a generation:
   "Regenerate tests for specs/form-test-plan.md with better error handling"
```

### Healing Prompts

```text
1. Fix a failing test:
   "The test tests/forms/email-validation.spec.ts is failing. Please fix the locators."

2. Debug specific error:
   "Fix the test in tests/checkout/payment.spec.ts - getting TIMEOUT_EXCEEDED"

3. Batch fix:
   "Review all tests in tests/navigation/ and fix any broken locators"
```

### Enhancement Prompts

```text
1. Add test scenarios:
   "Add edge case tests to specs/login-test-plan.md for network errors and timeouts"

2. Improve existing tests:
   "Review tests in tests/forms/ and add better assertions for form validation states"

3. Accessibility audit:
   "Create accessibility tests for the entire app based on tests/seed.spec.ts"
```

---

## Tips & Tricks

### 1. Start with Seed Test

The `tests/seed.spec.ts` provides a baseline for agent exploration:

```typescript
test('environment setup', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/.*/);
});
```

The agent uses this to understand your app structure.

### 2. Use Accessibility Snapshots

When working with the agent, request accessibility snapshots to understand page structure:

```text
Before generating tests, show me the accessibility snapshot of the login page
```

This helps you understand what elements are available and their accessible names.

### 3. Test ID Best Practices

Add `data-testid` attributes to hard-to-locate elements:

```html
<button data-testid="submit-btn">Submit</button>
```

But prefer semantic locators whenever possible.

### 4. Keep Tests Independent

Each test should be runnable in isolation. The agent will generate independent tests, but you can improve them:

```typescript
// ✅ Good - Each test is independent
test('create todo', async ({ page }) => {
  await page.goto('/todos');
  // ... create todo
});

// ❌ Bad - Test depends on previous test
test('create todo', async ({ page }) => {
  // Assumes state from previous test
});
```

### 5. Use Fixtures for Common Setup

Create fixtures in `tests/fixtures.ts` for reusable setup:

```typescript
export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@test.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/dashboard');
    await use(page);
  },
});
```

Then use in tests:

```typescript
test('user can upload avatar', async ({ authenticatedPage: page }) => {
  // Already logged in
  await page.goto('/settings');
});
```

### 6. Continuous Integration

Configure your CI pipeline to run tests automatically:

```bash
# .github/workflows/tests.yml
npm run lint && npm run type-check && npm test
```

The agent can help debug failures in CI.

### 7. Visual Regression Testing

Add visual snapshots to catch unintended UI changes:

```typescript
test('homepage layout', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot();
});
```

Update snapshots when intentional changes are made:

```bash
npm test -- --update-snapshots
```

---

## Workflow Summary

### Typical AI-Assisted Testing Flow

```text
1. PLANNING
   ↓
   Ask Planner agent: "Create test plan for feature X"
   ↓
   Review & edit specs/feature-X-test-plan.md
   ↓

2. GENERATION
   ↓
   Ask Generator agent: "Generate tests from specs/feature-X-test-plan.md"
   ↓
   Review generated tests/feature/scenario.spec.ts
   ↓
   npm test
   ↓

3. HEALING (if tests fail)
   ↓
   Ask Healer agent: "Fix failing test tests/feature/scenario.spec.ts"
   ↓
   Review changes
   ↓
   npm test
   ↓

4. MAINTENANCE
   ↓
   As app changes, ask agent to update tests
   ↓
   Run tests in CI/CD
   ↓
```

---

## Troubleshooting

### Agent Can't Find Elements

**Problem:** Agent generates tests but can't find elements

**Solution:**

1. Check that the app is running on the correct URL
2. Ask agent to show accessibility snapshot
3. Verify element's accessible name or role
4. Add `data-testid` if element is truly hard to locate

### Tests Fail in CI/CD

**Problem:** Tests pass locally but fail in CI

**Solution:**

1. Check for timing issues (add waits)
2. Verify responsive design (CI might use different viewport)
3. Check for network issues
4. Use traces: `npm test -- --trace on`

### Agent Times Out

**Problem:** Agent takes too long or times out

**Solution:**

1. Break complex features into smaller test plans
2. Reduce scope of exploration
3. Check for infinite loops or unresponsive elements
4. Increase timeout in agent configuration

---

## Next Steps

1. ✅ Set up Playwright MCP server
2. ✅ Configure your app URL in `playwright.config.ts`
3. ✅ Create initial test seed in `tests/seed.spec.ts`
4. ✅ Launch Playwright agent
5. ✅ Generate your first test plan
6. ✅ Review and iterate

Happy testing! 🎭
