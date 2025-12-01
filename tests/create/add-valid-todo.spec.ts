/**
 * Add Valid Todo Test
 *
 * spec: specs/basic-operations.md
 * seed: tests/seed.spec.ts
 *
 * This test demonstrates the Playwright Test Generator output format
 * for a typical todo application interaction.
 */
import { test, expect } from '@playwright/test';

test.describe('Adding New Todos', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the base URL before each test
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Add Valid Todo', async ({ page }) => {
    // 1. Click in the "What needs to be done?" input field
    // 2. Type "Buy groceries"
    await page.getByPlaceholder('What needs to be done?').fill('Buy groceries');

    // 3. Press Enter to submit
    await page.getByPlaceholder('What needs to be done?').press('Enter');

    // Verify: Todo item "Buy groceries" appears in the list
    await expect(page.getByTestId('todo-item')).toContainText('Buy groceries');
  });

  test('Add Multiple Todos', async ({ page }) => {
    const todoInput = page.getByPlaceholder('What needs to be done?');

    // 1. Add first todo
    await todoInput.fill('First todo item');
    await todoInput.press('Enter');

    // 2. Add second todo
    await todoInput.fill('Second todo item');
    await todoInput.press('Enter');

    // 3. Add third todo
    await todoInput.fill('Third todo item');
    await todoInput.press('Enter');

    // Verify: All three todos appear in the list
    const todoItems = page.getByTestId('todo-item');
    await expect(todoItems).toHaveCount(3);
    await expect(todoItems.nth(0)).toContainText('First todo item');
    await expect(todoItems.nth(1)).toContainText('Second todo item');
    await expect(todoItems.nth(2)).toContainText('Third todo item');
  });

  test('Add Empty Todo - Should Not Create Item', async ({ page }) => {
    const todoInput = page.getByPlaceholder('What needs to be done?');

    // 1. Leave input empty and press Enter
    await todoInput.focus();
    await todoInput.press('Enter');

    // Verify: No todo items are created
    await expect(page.getByTestId('todo-item')).toHaveCount(0);
  });

  test('Add Todo with Whitespace Only - Should Trim or Reject', async ({
    page,
  }) => {
    const todoInput = page.getByPlaceholder('What needs to be done?');

    // 1. Type whitespace only and press Enter
    await todoInput.fill('   ');
    await todoInput.press('Enter');

    // Verify: Either no item created, or item with trimmed (empty) text
    const todoItems = page.getByTestId('todo-item');
    const count = await todoItems.count();

    if (count > 0) {
      // If item was created, it should have trimmed text
      await expect(todoItems.first()).not.toHaveText('   ');
    }
  });
});
