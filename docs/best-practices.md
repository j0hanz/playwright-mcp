# Playwright Testing Best Practices

This guide provides comprehensive best practices for writing stable, maintainable, and efficient Playwright tests. These practices are based on official Playwright documentation and community experience.

**Table of Contents:**

- [Locator Strategies](#locator-strategies)
- [Web-First Assertions](#web-first-assertions)
- [Locator Chaining and Filtering](#locator-chaining-and-filtering)
- [Common Pitfalls](#common-pitfalls)
- [Error Handling](#error-handling)
- [Accessibility-First Testing](#accessibility-first-testing)
- [Performance Considerations](#performance-considerations)
- [Real-World Examples](#real-world-examples)

---

## Locator Strategies

### Priority Order (Most to Least Reliable)

| Priority | Locator         | Example                                   | When to Use                                                 |
| -------- | --------------- | ----------------------------------------- | ----------------------------------------------------------- |
| 1 ⭐     | **Role**        | `getByRole('button', { name: 'Submit' })` | Interactive elements (buttons, links, checkboxes)           |
| 2 ⭐     | **Label**       | `getByLabel('Email')`                     | Form fields with associated labels                          |
| 3        | **Placeholder** | `getByPlaceholder('Search...')`           | Inputs without labels but with placeholders                 |
| 4        | **Alt Text**    | `getByAltText('Logo')`                    | Images with alt attributes                                  |
| 5        | **Title**       | `getByTitle('Close')`                     | Elements with title attributes                              |
| 6        | **TestId**      | `getByTestId('submit-btn')`               | Elements with data-testid attribute (requires code changes) |
| 7        | **Text**        | `getByText('Learn more')`                 | Non-interactive text content                                |
| 8 ❌     | **CSS/XPath**   | `locator('.btn-primary')`                 | **Last resort only** — breaks with styling changes          |

### Why Semantic Locators Matter

**Accessibility-First:** Reflects how users and assistive technology perceive the page

- Screen readers use ARIA roles and accessible names
- Tests mirror real user interactions
- Improves application accessibility as a side benefit

**Resilience:** Not tied to implementation details

- CSS class changes won't break tests
- DOM restructuring (keeping semantic structure) won't break tests
- Updates to styling frameworks don't require test changes

**Maintainability:** Clear intent in tests

- Other developers understand what's being tested
- Easy to update if UI changes semantically
- Self-documenting code

#### Example: Good vs Bad Locators

```typescript
// ❌ BAD - Fragile CSS selector, breaks with style changes
await page.locator('div.header > nav > ul > li > a.active').click();
await page.locator('button.btn-primary.lg.mr-2').click();

// ✅ GOOD - Semantic locators, resilient to changes
await page.getByRole('navigation').getByRole('link', { name: 'Home' }).click();
await page.getByRole('button', { name: 'Submit' }).click();

// ❌ BAD - Direct property access without waiting
if (await page.locator('.error-message').isVisible()) {
  console.log('Error shown');
}

// ✅ GOOD - Web-first assertion that auto-waits
await expect(page.locator('.error-message')).toBeVisible();
```

### Locating by Role

The `getByRole` locator is the most recommended because it reflects how users and assistive technology perceive the page.

**Common roles:**

- `button`, `link`, `checkbox`, `radio`
- `textbox`, `searchbox`, `combobox`
- `heading`, `list`, `listitem`, `table`, `row`, `cell`
- `navigation`, `main`, `region`, `banner`, `contentinfo`

**Examples:**

```typescript
// Button by name
await page.getByRole('button', { name: 'Submit' }).click();

// Link by partial text
await page.getByRole('link', { name: /about/i }).click();

// Form controls
await page.getByRole('checkbox', { name: 'Subscribe' }).check();
await page.getByRole('radio', { name: 'Option 1' }).click();

// Headings
await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
```

### Locating by Label

Perfect for form inputs, as labels define the accessible name.

```typescript
// Label locators work for associated form controls
const emailInput = page.getByLabel('Email');
await emailInput.fill('user@example.com');

// HTML structure:
// <label for="email">Email</label>
// <input id="email" type="email" />
```

### Locating by Placeholder

Use when inputs don't have labels but have placeholders.

```typescript
await page.getByPlaceholder('name@example.com').fill('user@example.com');
```

### Locating by Text

Use for non-interactive elements like headings, paragraphs, or labels.

```typescript
// Exact match
await expect(page.getByText('Welcome, John')).toBeVisible();

// Case-insensitive match
await page.getByText(/welcome/i).click();

// Substring match (default)
await page.getByText('order #').click(); // Matches "My order #123"
```

### Locating by TestId

Use when you control the code and can add test IDs. Less ideal than semantic locators but very stable.

```html
<button data-testid="submit-btn">Submit</button>
```

```typescript
await page.getByTestId('submit-btn').click();
```

### When CSS/XPath is Necessary

**Use CSS selectors only as a last resort:**

```typescript
// ❌ Very fragile - depends on exact DOM structure
await page.locator('div > div > div > button').click();

// ✅ If CSS is necessary, be specific about what's important
await page.locator('[data-qa="delete-button"]').click();

// ✅ Use XPath only for complex queries not possible with other locators
await page.locator('//button[contains(., "Search")]').click();
```

---

## Web-First Assertions

Web-first assertions **auto-wait** for conditions to be met, preventing flakiness from race conditions.

### Key Assertion Principles

1. **Assertions auto-wait** — Wait up to 5 seconds (configurable) by default
2. **Use expect()** — All web-first assertions use the `expect()` API
3. **Never use direct checks without expect** — `isVisible()` returns immediately
4. **Configure timeout if needed** — `expect().toBeVisible({ timeout: 10000 })`

### Assertion Reference

**Visibility & Interactivity:**

```typescript
// Visibility
await expect(page.getByText('Success')).toBeVisible();
await expect(page.getByText('Loading')).toBeHidden();

// State
await expect(page.getByRole('button')).toBeEnabled();
await expect(page.getByRole('button')).toBeDisabled();
await expect(page.getByRole('checkbox')).toBeChecked();
await expect(page.getByRole('textbox')).toBeFocused();

// Other states
await expect(page.getByRole('textbox')).toBeEditable();
await expect(page.locator('form')).toBeEmpty();
```

**Text & Content:**

```typescript
// Exact text match
await expect(page.getByRole('heading')).toHaveText('Welcome');

// Partial text match
await expect(page.getByText('product')).toContainText('product');

// Multiple matches
const items = page.getByRole('listitem');
await expect(items).toHaveCount(3);
```

**Form & Input Values:**

```typescript
// Input value
await expect(page.getByLabel('Email')).toHaveValue('user@example.com');

// Select value
await expect(page.getByLabel('Country')).toHaveValue('US');

// Attribute presence
await expect(page.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
```

**CSS & Classes:**

```typescript
// CSS property
await expect(page.getByText('Header')).toHaveCSS('color', 'rgb(255, 0, 0)');

// CSS class
await expect(page.getByRole('button')).toHaveClass('active');
```

**Navigation:**

```typescript
// URL assertions
await expect(page).toHaveURL('/dashboard');
await expect(page).toHaveURL(/\/dashboard\?tab=\w+/);

// Title assertions
await expect(page).toHaveTitle('Welcome | My App');
```

### ❌ Common Anti-Patterns

```typescript
// ❌ NO - Direct check without expect, no auto-wait
if (await page.getByText('Success').isVisible()) {
  console.log('Test passed');
}

// ✅ YES - Use expect with auto-wait
await expect(page.getByText('Success')).toBeVisible();

// ❌ NO - await in condition (defeats purpose)
if (await page.getByText('Success').isVisible()) {
  await page.click('button');
}

// ✅ YES - Let expect handle the waiting
await expect(page.getByText('Success')).toBeVisible();
await page.getByRole('button').click();

// ❌ NO - waitForTimeout with arbitrary delay
await page.waitForTimeout(2000);
await page.getByText('Success').click();

// ✅ YES - Wait for specific condition
await page.getByRole('status').waitFor({ state: 'hidden' });
await page.getByText('Success').click();
```

---

## Locator Chaining and Filtering

Chaining narrows searches and reduces ambiguity, especially useful for dynamic content and nested elements.

### Basic Chaining

```typescript
// Find parent, then find child within it
const menuItem = page
  .getByRole('navigation')
  .getByRole('link', { name: 'Products' });

await menuItem.click();

// Equivalent to finding the link only within navigation
```

### Filtering by Text

```typescript
// Find row containing specific text, then click button within it
const row = page.getByRole('row').filter({ hasText: 'John Doe' });

await row.getByRole('button', { name: 'Edit' }).click();

// This ensures we click the Edit button for the correct person
```

### Filtering by Nested Element

```typescript
// Find list item that contains a specific element
const cartItem = page.getByRole('listitem').filter({
  has: page.getByText('Product A'),
});

await cartItem.getByRole('button', { name: 'Remove' }).click();
```

### Advanced Filtering

```typescript
// Find table row with multiple conditions
const row = page
  .getByRole('row')
  .filter({ hasText: 'Active' })
  .filter({
    has: page.getByRole('cell').filter({ hasText: 'Premium' }),
  });

// Find first matching element
const firstItem = page.getByRole('listitem').first();

// Find last matching element
const lastItem = page.getByRole('listitem').last();

// Find nth matching element (0-indexed)
const thirdItem = page.getByRole('listitem').nth(2);
```

### Real-World Example: Dynamic Table

```typescript
test('Edit specific product', async ({ page }) => {
  await page.goto('/products');

  // Find the row for product "Laptop", then click its edit button
  const laptopRow = page.getByRole('row').filter({ hasText: 'Laptop' });

  // Verify the row is visible before interacting
  await expect(laptopRow).toBeVisible();

  // Click edit button within that specific row
  await laptopRow.getByRole('button', { name: 'Edit' }).click();

  // Verify navigation to edit page
  await expect(page).toHaveURL(/\/products\/\d+\/edit/);
});
```

---

## Common Pitfalls

### 1. Using `waitForTimeout`

**❌ Don't:**

```typescript
// Arbitrary waits are the enemy of fast tests
await page.waitForTimeout(2000);
await page.getByText('Success').click();
```

**✅ Do:**

```typescript
// Wait for specific conditions
await page.getByRole('status').waitFor({ state: 'hidden' });
await page.getByText('Success').click();
```

**Why:** Arbitrary delays slow down tests and don't actually wait for the right condition. Use specific waits instead.

### 2. Using `networkidle` Load State

**❌ Don't:**

```typescript
// Unreliable and varies by network conditions
await page.waitForLoadState('networkidle');
```

**✅ Do:**

```typescript
// Use domcontentloaded for SPAs
await page.waitForLoadState('domcontentloaded');

// Or wait for specific element
await page.getByRole('status').waitFor({ state: 'hidden' });
```

**Why:** Network idle timing varies greatly and causes flakiness. Wait for DOM ready or specific elements instead.

### 3. Using CSS Class Selectors

**❌ Don't:**

```typescript
// Breaks when designer changes classes
await page.locator('button.btn-primary.lg.ml-4.shadow-lg').click();
```

**✅ Do:**

```typescript
// Use role with accessible name
await page.getByRole('button', { name: 'Submit' }).click();
```

**Why:** CSS classes are implementation details. Use semantic locators that reflect user-facing attributes.

### 4. Direct Visibility Check

**❌ Don't:**

```typescript
// No auto-wait, returns immediately
const isVisible = await page.getByText('Success').isVisible();
if (isVisible) {
  console.log('Success!');
}
```

**✅ Do:**

```typescript
// Auto-waits for element to be visible
await expect(page.getByText('Success')).toBeVisible();
```

**Why:** Direct checks return immediately without waiting. Assertions auto-wait and are more reliable.

### 5. Leaving `.only()` or `.skip()` in Tests

**❌ Don't:**

```typescript
test.only('specific scenario', async ({ page }) => {
  // If this gets committed, other tests won't run!
});
```

**✅ Do:**

```typescript
// Remove before committing
test('specific scenario', async ({ page }) => {
  // ...
});
```

**Why:** Easy to accidentally commit `.only()` which prevents all other tests from running.

### 6. Using Screenshots as Locators

**❌ Don't:**

```typescript
// Can't programmatically interact with images
const screenshot = await page.screenshot();
// Try to find something in the screenshot...
```

**✅ Do:**

```typescript
// Use browser_snapshot to understand page structure
const snapshot = await page.accessibility.snapshot();
// Use accessibility tree to find elements
```

**Why:** Screenshots are visual data only. Use the accessibility tree to find elements programmatically.

### 7. Relying on `test.fixme()` Incorrectly

**❌ Don't:**

```typescript
test.fixme('should work', async ({ page }) => {
  // Skipped test without clear reason
});
```

**✅ Do:**

```typescript
test.fixme('should work', async ({ page }) => {
  // TODO: Application bug - modal doesn't close on ESC key
  // Expected: Modal closes
  // Actual: Modal stays open
  // Track: GitHub issue #123
});
```

**Why:** Always document why a test is skipped and what needs to be fixed.

---

## Error Handling

### Graceful Error Handling

```typescript
test('handle errors gracefully', async ({ page }) => {
  try {
    await page.goto('https://invalid-url.test');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
  }
});
```

### Retry Logic for Flaky Operations

```typescript
// Playwright has built-in retry in assertions
await expect(page.getByText('Success')).toBeVisible(); // Retries automatically

// For custom retry logic
async function retryUntil(fn: () => Promise<boolean>, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      if (await fn()) return;
    } catch (e) {
      if (i === maxAttempts - 1) throw e;
    }
    await page.waitForTimeout(100);
  }
}
```

---

## Accessibility-First Testing

### Use `browser_snapshot` to Understand Page Structure

Before writing interactions, understand the accessibility tree:

```typescript
test('understand page structure', async ({ page }) => {
  await page.goto('/');

  // Get accessibility tree
  const snapshot = await page.accessibility.snapshot();

  // Inspects the accessible names and roles of all elements
  console.log(JSON.stringify(snapshot, null, 2));

  // Use this to find appropriate locators
});
```

### Accessibility Scanning

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('check accessibility', async ({ page }) => {
  await page.goto('/');
  await injectAxe(page);
  await checkA11y(page);
});
```

### Write Tests That Reflect User Interactions

```typescript
test('user flow with semantic locators', async ({ page }) => {
  await page.goto('/checkout');

  // Users see a form with fields
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Card Number').fill('4111111111111111');

  // Users click buttons by their visible text
  await page.getByRole('button', { name: 'Place Order' }).click();

  // Users read messages and headings
  await expect(page.getByRole('heading')).toContainText('Order Confirmed');
});
```

---

## Performance Considerations

### Parallel Test Execution

Playwright can run tests in parallel by default. Configuration in `playwright.config.ts`:

```typescript
export default defineConfig({
  fullyParallel: true, // Run all tests in parallel
  workers: 4, // Number of worker threads
});
```

### Efficient Resource Usage

```typescript
// ✅ Reuse browser context when possible
test.use({
  launchOptions: { headless: true },
});

// ✅ Use fixtures for common setup
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
});

// ✅ Clean up properly
test.afterEach(async ({ page }) => {
  // Clear storage, close popups, etc.
  await page.context().clearCookies();
});
```

### Test Isolation

```typescript
// ✅ Each test should be independent
test('create and delete', async ({ page }) => {
  // Create
  await page.goto('/items/new');
  await page.getByLabel('Name').fill('Test Item');
  await page.getByRole('button', { name: 'Create' }).click();

  // Delete (same test, isolated from others)
  await page.goto('/items');
  await page.getByRole('button', { name: 'Delete' }).click();
});

// ❌ Don't rely on test execution order
// test1() creates item
// test2() deletes item (depends on test1)
```

---

## Real-World Examples

### Login Flow

```typescript
test('user can log in', async ({ page }) => {
  await page.goto('/login');

  // Fill form using semantic locators
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('securePassword123');

  // Submit
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Verify successful login
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading')).toContainText('Welcome');
});
```

### Dynamic List Interaction

```typescript
test('can mark item as done', async ({ page }) => {
  await page.goto('/todos');

  // Wait for list to load
  await expect(page.getByRole('listitem')).not.toHaveCount(0);

  // Find specific item and mark as done
  const todoItem = page
    .getByRole('listitem')
    .filter({ hasText: 'Buy groceries' });

  await todoItem.getByRole('checkbox').check();

  // Verify state changed
  await expect(todoItem).toHaveClass(/done/);
});
```

### Form Validation

```typescript
test('shows validation errors', async ({ page }) => {
  await page.goto('/form');

  // Submit empty form
  await page.getByRole('button', { name: 'Submit' }).click();

  // Verify error messages
  await expect(page.getByText('Email is required')).toBeVisible();
  await expect(page.getByText('Password is required')).toBeVisible();

  // Fix and resubmit
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Submit' }).click();

  // Verify success
  await expect(page).toHaveURL('/success');
});
```

### Modal Dialog

```typescript
test('can open and close modal', async ({ page }) => {
  await page.goto('/');

  // Open modal
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Interact in modal
  await page.getByRole('dialog').getByLabel('Theme').selectOption('dark');

  // Close modal
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
```

---

## References

- [Playwright Official Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Web-First Assertions](https://playwright.dev/docs/test-assertions)
- [Locators Guide](https://playwright.dev/docs/locators)
- [ARIA and Accessibility](https://www.w3.org/TR/wai-aria-1.2/)
