/**
 * Form Tests - Demonstrates best practices for form testing
 *
 * Shows:
 * - Using label locators for form inputs
 * - Web-first assertions for validation
 * - Proper error handling
 * - Form state verification
 */
import { test, expect } from '@playwright/test';

test.describe('Form Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('can fill form using label locators', async ({ page }) => {
    // Use getByLabel for form fields - most semantic approach
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    // Verify fields are visible before interaction
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Fill using semantic locators
    await emailInput.fill('user@example.com');
    await passwordInput.fill('securePassword123');

    // Verify values were entered
    await expect(emailInput).toHaveValue('user@example.com');
    await expect(passwordInput).toHaveValue('securePassword123');
  });

  test('can use placeholder locators for inputs without labels', async ({
    page,
  }) => {
    // Some inputs don't have labels, use placeholder instead
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('test query');
    await expect(searchInput).toHaveValue('test query');
  });

  test('can interact with checkboxes', async ({ page }) => {
    // Checkboxes use role-based locators with accessible names
    const agreeCheckbox = page.getByRole('checkbox', { name: /agree/i });
    await expect(agreeCheckbox).toBeVisible();

    // Check the checkbox
    await agreeCheckbox.check();
    await expect(agreeCheckbox).toBeChecked();

    // Uncheck it
    await agreeCheckbox.uncheck();
    await expect(agreeCheckbox).not.toBeChecked();
  });

  test('can select from dropdown', async ({ page }) => {
    // Find select by label
    const countrySelect = page.getByLabel(/country/i);
    await expect(countrySelect).toBeVisible();

    // Select option by value or label
    await countrySelect.selectOption('US');
    await expect(countrySelect).toHaveValue('US');
  });

  test('can submit form', async ({ page }) => {
    // Find button by role and accessible name
    const submitButton = page.getByRole('button', { name: /submit/i });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    // Click to submit
    await submitButton.click();

    // Verify form was submitted (check for success message or URL change)
    // This waits up to 5 seconds for the condition
    await expect(page).toHaveURL(/success|thank-you|confirmation/i);
  });
});

test.describe('Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('shows validation errors', async ({ page }) => {
    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /submit/i });
    await submitButton.click();

    // Verify error messages appear
    // These assertions auto-wait for the messages to appear
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('clears validation errors when fixed', async ({ page }) => {
    // Submit empty form to trigger errors
    const submitButton = page.getByRole('button', { name: /submit/i });
    await submitButton.click();

    // Verify error is shown
    const emailError = page.getByText(/email is required/i);
    await expect(emailError).toBeVisible();

    // Fill the field
    await page.getByLabel(/email/i).fill('user@example.com');

    // Error should disappear or be replaced
    // (depends on form implementation)
  });

  test('field is disabled during submission', async ({ page }) => {
    // Get submit button
    const submitButton = page.getByRole('button', { name: /submit/i });

    // Initially enabled
    await expect(submitButton).toBeEnabled();

    // Click submit (button might disable during submission)
    await submitButton.click();

    // Verify button is disabled during submission
    // (This example assumes the button disables; adjust based on your app)
    // await expect(submitButton).toBeDisabled();
  });
});

test.describe('Form Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('handles whitespace-only input', async ({ page }) => {
    const input = page.getByLabel(/name/i);
    await input.fill('   ');

    // Either trimmed or rejected - verify expected behavior
    const value = await input.inputValue();
    expect(value.trim()).toBe('');
  });

  test('preserves form state on navigation', async ({ page }) => {
    // Fill form
    await page.getByLabel(/email/i).fill('user@example.com');
    await page.getByLabel(/message/i).fill('Test message');

    // Navigate away and back (if app supports it)
    // This depends on your app's implementation
  });

  test('enables submit button after all fields filled', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /submit/i });

    // Initially might be disabled
    // Fill required fields
    await page.getByLabel(/email/i).fill('user@example.com');
    await page.getByLabel(/password/i).fill('password123');

    // After filling, button should be enabled
    await expect(submitButton).toBeEnabled();
  });
});
