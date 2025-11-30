# Playwright Test Agents Integration Guide

This document explains how your MCP Playwright server integrates with Playwright Test Agents for AI-powered test generation, planning, and repair.

## 🎭 What are Playwright Test Agents?

Playwright Test Agents are three specialized AI agents that work together to automate test creation and maintenance:

1. **🎭 Planner** - Explores your application and creates human-readable Markdown test plans
2. **🎭 Generator** - Transforms Markdown plans into executable Playwright test files
3. **🎭 Healer** - Runs tests and automatically repairs failing tests

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│  AI Tools (Claude, VS Code)         │
│  (Planner, Generator, Healer)       │
└──────────────────┬──────────────────┘
                   │ MCP Protocol
                   ▼
┌─────────────────────────────────────┐
│  Your MCP Playwright Server         │
├─────────────────────────────────────┤
│ ✓ Browser Tools                     │
│   - browser_launch                  │
│   - browser_navigate                │
│   - element_click, element_fill     │
│   - page_screenshot                 │
│ ✓ Assertion Tools                   │
│   - assert_visible, assert_text     │
│   - assert_value, assert_url        │
│ ✓ Test Artifact Tools (NEW!)        │
│   - test_plan_create                │
│   - test_file_create                │
│   - test_file_update                │
│   - test_file_read                  │
│   - test_artifacts_list             │
│   - test_artifact_delete            │
│ ✓ Resources                         │
│   - playwright://artifacts/specs    │
│   - playwright://artifacts/tests    │
└──────────────────┬──────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Browser Sessions     │
        │ (Chromium, Firefox)  │
        └──────────────────────┘
```

## 🚀 Quick Start

### 1. Agent Definitions Already Generated

The agent configuration files have been generated in `.github/agents/`:

```
.github/agents/
├── playwright-test-planner.agent.md      # Creates test plans
├── playwright-test-generator.agent.md    # Generates test files
├── playwright-test-healer.agent.md       # Repairs failing tests
└── context7.agent.md                     # Documentation agent
```

### 2. Seed Test Template

Your seed test is located at `tests/seed.spec.ts`. Agents use this as a template to:

- Understand your test environment
- Learn your testing conventions
- Generate consistent, idiomatic tests

**Example seed test:**

```typescript
test('seed', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});
```

### 3. Test Artifacts Directories

```
specs/                          # Markdown test plans
├── README.md                   # Directory guide
└── *.md                        # Generated test plans

tests/
├── seed.spec.ts               # Seed template
└── *.spec.ts                  # Generated test files
```

## 📋 Agent Workflow

### Stage 1: Planning (Planner Agent)

The Planner agent explores your application and creates a test plan:

```
Planner Input:
  - Your app URL
  - Seed test for environment context
  - Optional: Product requirements document

Planner Uses Tools:
  ✓ browser_launch          # Start browser
  ✓ browser_navigate        # Navigate to pages
  ✓ page_screenshot         # Capture UI
  ✓ element_click/fill      # Interact with app
  ✓ page_content            # Get HTML/text
  ✓ test_plan_create        # Save Markdown plan → specs/

Planner Output:
  specs/feature-name.md     # Human-readable test plan
```

**Example plan output:**

```markdown
# Application Test Plan

## Test Scenarios

### 1. User Login

1. Navigate to login page
2. Enter username: user@example.com
3. Enter password: password123
4. Click login button
5. Verify redirect to dashboard
```

### Stage 2: Generation (Generator Agent)

The Generator transforms plans into executable tests:

```
Generator Input:
  - Markdown plan from specs/

Generator Uses Tools:
  ✓ browser_launch          # Start browser
  ✓ browser_navigate        # Go to pages
  ✓ element_click/fill      # Perform interactions
  ✓ page_screenshot         # Verify UI state
  ✓ assert_visible/text     # Add assertions
  ✓ test_file_create        # Save test → tests/

Generator Output:
  tests/login.spec.ts       # Executable Playwright test
```

**Example generated test:**

```typescript
test('user login flow', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.fill('[data-testid="username"]', 'user@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="login-btn"]');
  await page.waitForURL('**/dashboard');
  await expect(page).toHaveTitle(/Dashboard/);
});
```

### Stage 3: Healing (Healer Agent)

The Healer fixes failing tests automatically:

```
Healer Input:
  - Name of failing test

Healer Uses Tools:
  ✓ browser_launch          # Reproduce test
  ✓ browser_navigate        # Navigate to pages
  ✓ element_click/fill      # Perform interactions
  ✓ page_screenshot         # Inspect current UI
  ✓ wait_for_selector       # Check element state
  ✓ test_file_update        # Save fixed test

Healer Output:
  tests/login.spec.ts       # Updated, passing test
```

**Example fix:**

```typescript
// Before: Broken selector
await page.click('[data-testid="login-btn"]'); // Element not found

// After: Fixed selector
await page.click('[role="button", name="Login"]'); // Works!
```

## 🛠️ New MCP Tools for Test Artifacts

Six new tools have been added to support agent workflows:

### `test_plan_create`

Create a new Markdown test plan.

```typescript
await mcp.call('test_plan_create', {
  name: 'checkout-flow',
  content: '# Checkout Test Plan\n\n## Scenarios\n...',
});

// Creates: specs/checkout-flow.md
```

### `test_file_create`

Create a new test specification file.

```typescript
await mcp.call('test_file_create', {
  name: 'checkout-complete',
  content: 'test("user completes checkout", async ({ page }) => { ... });',
});

// Creates: tests/checkout-complete.spec.ts
```

### `test_file_update`

Update an existing test file (used by Healer agent).

```typescript
await mcp.call('test_file_update', {
  path: 'tests/checkout-complete.spec.ts',
  content: 'test("user completes checkout", async ({ page }) => { ... });',
  reason: 'Fixed broken locator for payment button',
});
```

### `test_file_read`

Read the content of a test or plan file.

```typescript
const { content } = await mcp.call('test_file_read', {
  path: 'specs/checkout-flow.md',
});
```

### `test_artifacts_list`

List all test plans and test files.

```typescript
const { specs, tests, total } = await mcp.call('test_artifacts_list', {
  type: 'all', // 'specs', 'tests', or 'all'
});

// Returns:
// {
//   specs: ['checkout-flow.md', 'login-flow.md'],
//   tests: ['checkout-complete.spec.ts', 'login-valid.spec.ts'],
//   total: 4
// }
```

### `test_artifact_delete`

Delete a test plan or test file.

```typescript
await mcp.call('test_artifact_delete', {
  path: 'specs/old-plan.md',
});
```

## 📚 Resources

Two new resources provide directory listings:

### `playwright://artifacts/specs`

Lists all Markdown test plans:

```json
{
  "type": "test-plans",
  "count": 2,
  "specs": [
    {
      "name": "checkout-flow.md",
      "path": "specs/checkout-flow.md",
      "uri": "playwright://artifacts/specs/checkout-flow.md"
    }
  ]
}
```

### `playwright://artifacts/tests`

Lists all test specification files:

```json
{
  "type": "test-specifications",
  "count": 3,
  "tests": [
    {
      "name": "checkout-complete.spec.ts",
      "path": "tests/checkout-complete.spec.ts",
      "uri": "playwright://artifacts/tests/checkout-complete.spec.ts"
    }
  ]
}
```

## 🎯 Using Agents with VS Code

### 1. Ensure VS Code 1.105+

VS Code v1.105 (released October 9, 2025) or later is required for the agentic experience.

### 2. Configure MCP Client

Your `.vscode/mcp.json` has been auto-generated:

```json
{
  "mcpServers": {
    "playwright-test": {
      "type": "stdio",
      "command": "npx",
      "args": ["playwright", "run-test-mcp-server"],
      "tools": ["*"]
    }
  }
}
```

### 3. Enable GitHub Copilot Agents

In VS Code:

1. Go to **Settings** → **GitHub Copilot** → **Coding agent** → **MCP configuration**
2. Add the MCP configuration from `/.vscode/mcp.json`
3. Restart VS Code

### 4. Invoke Agents in Chat

Use the slash commands in Copilot Chat:

```
/planner Generate a test plan for the checkout flow

/generator Generate tests from specs/checkout-flow.md

/healer Fix failing test: tests/checkout-complete.spec.ts
```

## 💡 Best Practices

### For Seed Tests

1. **Keep it simple** - Use basic app initialization
2. **Show patterns** - Demonstrate your testing conventions
3. **Add comments** - Explain non-obvious setup steps
4. **Include authentication** - If tests need pre-auth state

```typescript
// Good seed test
test('seed', async ({ page }) => {
  // Navigate to app
  await page.goto('https://example.com');

  // Handle login if needed
  if (process.env.TEST_USER) {
    await page.fill('[data-testid="username"]', process.env.TEST_USER);
    await page.fill('[data-testid="password"]', process.env.TEST_PASSWORD);
    await page.click('[data-testid="login-btn"]');
    await page.waitForNavigation();
  }

  // Verify readiness
  await expect(page).toHaveTitle(/Dashboard/);
});
```

### For Test Plans

1. **User-focused scenarios** - Describe real user workflows
2. **Clear step numbering** - Make steps actionable
3. **Include assertions** - Specify what to verify
4. **Real data examples** - Use realistic test data

```markdown
## Test Scenario: User Registration

**Steps:**

1. Navigate to signup page
2. Enter email: newuser@example.com
3. Enter password: SecurePass123!
4. Click "Sign Up" button
5. Enter verification code from email

**Expected Results:**

- User account created
- Redirected to dashboard
- Welcome email received
- User can login with new credentials
```

### For Test Files

1. **Meaningful names** - Use `{feature}-{scenario}.spec.ts`
2. **Clear descriptions** - Each test has a clear purpose
3. **Proper assertions** - Verify both UI and data state
4. **Error handling** - Test edge cases and error flows

```typescript
test('user registers with valid email', async ({ page }) => {
  // Setup
  await page.goto('/signup');

  // Action
  await page.fill('[data-testid="email"]', 'newuser@example.com');
  await page.fill('[data-testid="password"]', 'SecurePass123!');
  await page.click('[data-testid="signup-btn"]');

  // Assertion
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('[data-testid="welcome-message"]')).toContainText(
    'Welcome, newuser!'
  );
});
```

## 🔄 Complete Workflow Example

### Step 1: Create Test Plan

**User Request:** "Create a test plan for the checkout flow"

**Planner Agent:**

- Launches browser
- Navigates to checkout page
- Explores UI and interactions
- Creates `specs/checkout-flow.md`

### Step 2: Generate Tests

**User Request:** "Generate tests from specs/checkout-flow.md"

**Generator Agent:**

- Reads `specs/checkout-flow.md`
- Launches browser and executes steps
- Creates `tests/checkout-flow.spec.ts`
- Verifies selectors work correctly

### Step 3: Run & Fix Tests

**User Request:** "Run tests and fix any that fail"

**Healer Agent:**

- Runs `tests/checkout-flow.spec.ts`
- If a test fails:
  - Replays the failing steps
  - Inspects current UI
  - Updates broken selectors
  - Saves fixed test

## 📊 Agent Capabilities Matrix

| Capability          | Planner | Generator | Healer |
| ------------------- | ------- | --------- | ------ |
| Browser automation  | ✓       | ✓         | ✓      |
| Page navigation     | ✓       | ✓         | ✓      |
| Element interaction | ✓       | ✓         | ✓      |
| Screenshots         | ✓       | ✓         | ✓      |
| Create test plans   | ✓       | -         | -      |
| Generate test files | -       | ✓         | -      |
| Repair tests        | -       | -         | ✓      |
| Read test files     | ✓       | ✓         | ✓      |
| List artifacts      | ✓       | ✓         | ✓      |

## 🚨 Troubleshooting

### "Agent can't find test_plan_create tool"

**Solution:** Ensure your MCP server is running and connected:

```bash
npm run start
```

### "Agents generate tests but selectors are wrong"

**Solution:** Improve your seed test with better examples:

```typescript
// Use role-based locators (preferred by agents)
await page.click('[role="button"]');

// Use data-testid for consistency
await page.fill('[data-testid="email"]', 'user@example.com');

// Use accessible names
await expect(page.getByRole('heading')).toContainText('Welcome');
```

### "Tests keep failing after generation"

**Solution:**

1. Run Healer agent to auto-fix
2. Check if page structure changed
3. Update seed test to reflect new patterns

## 🔗 Related Documentation

- [Playwright Test Agents Docs](https://playwright.dev/docs/test-agents)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [This Repository](https://github.com/j0hanz/playwright-mcp)

## 📝 Summary

Your MCP Playwright server is now fully integrated with Playwright Test Agents! You can use AI agents to:

✅ **Plan** test scenarios automatically  
✅ **Generate** test code from plans  
✅ **Repair** failing tests on-the-fly  
✅ **Manage** test artifacts through MCP tools  
✅ **Scale** test coverage efficiently

Happy testing! 🎭
