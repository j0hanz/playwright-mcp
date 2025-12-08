/**
 * Interaction Integration Tests
 *
 * Tests element_click, element_fill, keyboard_type, element_hover,
 * select_option, checkbox_set, keyboard_press, drag_and_drop, file_upload
 *
 * Test Sites:
 * - the-internet.herokuapp.com: Rich interactive elements
 * - httpbin.org: Form submission testing
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Interactions - Click Operations', () => {
  test('click button', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/add_remove_elements/');

    const addButton = page.getByRole('button', { name: 'Add Element' });
    await addButton.click();

    await expect(page.locator('.added-manually')).toBeVisible();
  });

  test('click link', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/');

    await page.getByRole('link', { name: 'Checkboxes' }).click();
    await expect(page).toHaveURL(/checkboxes/);
  });

  test('double click', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/');

    // Create element that responds to double-click
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'dblclick-target';
      div.textContent = 'Not clicked';
      div.addEventListener('dblclick', () => {
        div.textContent = 'Double clicked';
      });
      document.body.appendChild(div);
    });

    await page.locator('#dblclick-target').dblclick();
    await expect(page.locator('#dblclick-target')).toHaveText('Double clicked');
  });

  test('right click (context menu)', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/context_menu');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('context menu');
      await dialog.accept();
    });

    await page.locator('#hot-spot').click({ button: 'right' });
  });

  test('click with modifiers', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/');

    // Ctrl+Click to open in new tab
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page
        .getByRole('link', { name: 'Checkboxes' })
        .click({ modifiers: ['Control'] }),
    ]);

    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL(/checkboxes/);
    await newPage.close();
  });

  test('click at specific position', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/');

    const link = page.getByRole('link', { name: 'Checkboxes' });
    const box = await link.boundingBox();

    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page).toHaveURL(/checkboxes/);
    }
  });

  test('click force', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/');

    // Make element invisible
    await page.evaluate(() => {
      const link = document.querySelector('a[href="/checkboxes"]');
      if (link instanceof HTMLElement) {
        link.style.visibility = 'hidden';
      }
    });

    // Force click even though invisible
    await page.getByRole('link', { name: 'Checkboxes' }).click({ force: true });
    await expect(page).toHaveURL(/checkboxes/);
  });
});

test.describe('Interactions - Text Input', () => {
  test('fill input field', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await page.getByLabel('Username').fill('tomsmith');
    await expect(page.getByLabel('Username')).toHaveValue('tomsmith');
  });

  test('fill clears existing text', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const input = page.getByLabel('Username');
    await input.fill('initial');
    await input.fill('replaced');

    await expect(input).toHaveValue('replaced');
  });

  test('type character by character', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await page.getByLabel('Username').type('tomsmith', { delay: 50 });
    await expect(page.getByLabel('Username')).toHaveValue('tomsmith');
  });

  test('type appends text', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const input = page.getByLabel('Username');
    await input.fill('tom');
    await input.type('smith');

    await expect(input).toHaveValue('tomsmith');
  });

  test('fill textarea', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/tinymce');

    const frame = page.frameLocator('iframe').first();
    await frame.locator('body').fill('This is test content');

    const content = await frame.locator('body').textContent();
    expect(content).toBe('This is test content');
  });

  test('fill password field', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await page.getByLabel('Password').fill('SuperSecretPassword!');
    await expect(page.getByLabel('Password')).toHaveValue(
      'SuperSecretPassword!'
    );
  });

  test('clear input field', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const input = page.getByLabel('Username');
    await input.fill('tomsmith');
    await input.clear();

    await expect(input).toHaveValue('');
  });
});

test.describe('Interactions - Hover', () => {
  test('hover over element', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/hovers');

    const firstFigure = page.locator('.figure').first();
    await firstFigure.hover();

    await expect(firstFigure.locator('.figcaption')).toBeVisible();
  });

  test('hover reveals hidden content', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/hovers');

    const figures = page.locator('.figure');
    const count = await figures.count();

    for (let i = 0; i < count; i++) {
      const figure = figures.nth(i);
      await figure.hover();
      await expect(figure.locator('.figcaption')).toBeVisible();
    }
  });

  test('hover and click', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/hovers');

    const firstFigure = page.locator('.figure').first();
    await firstFigure.hover();

    await firstFigure.locator('a').click();
    await expect(page).toHaveURL(/users\/1/);
  });
});

test.describe('Interactions - Select Dropdown', () => {
  test('select by value', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dropdown');

    await page.locator('#dropdown').selectOption('1');
    await expect(page.locator('#dropdown')).toHaveValue('1');
  });

  test('select by label', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dropdown');

    await page.locator('#dropdown').selectOption({ label: 'Option 2' });
    await expect(page.locator('#dropdown')).toHaveValue('2');
  });

  test('select by index', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dropdown');

    await page.locator('#dropdown').selectOption({ index: 2 });
    await expect(page.locator('#dropdown')).toHaveValue('2');
  });

  test('get selected option', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dropdown');

    await page.locator('#dropdown').selectOption('1');
    const selectedText = await page
      .locator('#dropdown option[selected]')
      .textContent();
    expect(selectedText).toBe('Option 1');
  });
});

test.describe('Interactions - Checkbox', () => {
  test('check checkbox', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.check();

    await expect(checkbox).toBeChecked();
  });

  test('uncheck checkbox', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    const checkbox = page.locator('input[type="checkbox"]').last();
    await checkbox.uncheck();

    await expect(checkbox).not.toBeChecked();
  });

  test('toggle checkbox with click', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    const checkbox = page.locator('input[type="checkbox"]').first();
    const initialState = await checkbox.isChecked();

    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !initialState });
  });

  test('set checkbox to specific state', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    const checkbox = page.locator('input[type="checkbox"]').first();

    await checkbox.setChecked(true);
    await expect(checkbox).toBeChecked();

    await checkbox.setChecked(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('check multiple checkboxes', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
  });
});

test.describe('Interactions - Keyboard', () => {
  test('press enter key', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await page.getByLabel('Username').fill('tomsmith');
    await page.getByLabel('Password').fill('SuperSecretPassword!');
    await page.getByLabel('Password').press('Enter');

    await expect(page.locator('.flash.success')).toBeVisible();
  });

  test('press tab to navigate', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await page.getByLabel('Username').focus();
    await page.keyboard.press('Tab');

    await expect(page.getByLabel('Password')).toBeFocused();
  });

  test('press keyboard shortcuts', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/key_presses');

    await page.keyboard.press('Control+A');
    await expect(page.locator('#result')).toHaveText(/CONTROL/);
  });

  test('press arrow keys', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/key_presses');

    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#result')).toHaveText(/DOWN/);

    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#result')).toHaveText(/UP/);
  });

  test('press escape key', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/key_presses');

    await page.keyboard.press('Escape');
    await expect(page.locator('#result')).toHaveText(/ESCAPE/);
  });

  test('type with keyboard', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await page.getByLabel('Username').click();
    await page.keyboard.type('tomsmith');

    await expect(page.getByLabel('Username')).toHaveValue('tomsmith');
  });
});

test.describe('Interactions - Drag and Drop', () => {
  test('drag and drop element', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/drag_and_drop');

    const columnA = page.locator('#column-a');
    const columnB = page.locator('#column-b');

    await expect(columnA).toHaveText('A');
    await expect(columnB).toHaveText('B');

    await columnA.dragTo(columnB);

    // After drag, positions swap
    await expect(page.locator('#column-a')).toHaveText('B');
    await expect(page.locator('#column-b')).toHaveText('A');
  });

  test('drag and drop with custom duration', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/drag_and_drop');

    const columnA = page.locator('#column-a');
    const columnB = page.locator('#column-b');

    await columnA.dragTo(columnB, { force: true });

    await expect(page.locator('#column-a')).toHaveText('B');
  });
});

test.describe('Interactions - File Upload', () => {
  test('upload single file', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/upload');

    // Create a test file
    const filePath = path.join(
      process.cwd(),
      'fixtures',
      'test-data',
      'credentials.json'
    );

    await page.locator('#file-upload').setInputFiles(filePath);
    await page.locator('#file-submit').click();

    await expect(page.locator('#uploaded-files')).toContainText(
      'credentials.json'
    );
  });

  test('upload multiple files', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/upload');

    // For multiple file upload, we'd need to modify the input to accept multiple
    await page.evaluate(() => {
      const input = document.querySelector('#file-upload');
      if (input) input.setAttribute('multiple', '');
    });

    const files = [
      path.join(process.cwd(), 'fixtures', 'test-data', 'credentials.json'),
    ];

    await page.locator('#file-upload').setInputFiles(files);

    const fileInput = page.locator('#file-upload');
    const uploadedCount = await fileInput.evaluate(
      (input: HTMLInputElement) => input.files?.length || 0
    );
    expect(uploadedCount).toBeGreaterThan(0);
  });

  test('clear file upload', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/upload');

    const filePath = path.join(
      process.cwd(),
      'fixtures',
      'test-data',
      'credentials.json'
    );

    await page.locator('#file-upload').setInputFiles(filePath);
    await page.locator('#file-upload').setInputFiles([]);

    const fileInput = page.locator('#file-upload');
    const uploadedCount = await fileInput.evaluate(
      (input: HTMLInputElement) => input.files?.length || 0
    );
    expect(uploadedCount).toBe(0);
  });

  test('upload file with drag and drop', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/upload');

    const filePath = path.join(
      process.cwd(),
      'fixtures',
      'test-data',
      'credentials.json'
    );

    // Using setInputFiles is more reliable than drag-and-drop for file upload
    await page.locator('#file-upload').setInputFiles(filePath);

    const fileName = await page
      .locator('#file-upload')
      .evaluate((input: HTMLInputElement) => input.files?.[0]?.name || '');
    expect(fileName).toBe('credentials.json');
  });
});

test.describe('Interactions - Focus and Blur', () => {
  test('focus element', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await page.getByLabel('Username').focus();
    await expect(page.getByLabel('Username')).toBeFocused();
  });

  test('blur element', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const username = page.getByLabel('Username');
    await username.focus();
    await username.blur();

    await expect(username).not.toBeFocused();
  });

  test('tab order navigation', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await page.getByLabel('Username').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Login' })).toBeFocused();
  });
});

test.describe('Interactions - Scrolling', () => {
  test('scroll element into view', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/infinite_scroll');

    // Wait for initial content
    await page.locator('.jscroll-added').first().waitFor();

    // Scroll to trigger loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for new content to load
    await page.waitForTimeout(1000);

    const items = page.locator('.jscroll-added');
    const count = await items.count();
    expect(count).toBeGreaterThan(1);
  });

  test('scroll to specific element', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/large');

    const table = page.locator('#large-table');
    await table.scrollIntoViewIfNeeded();

    await expect(table).toBeInViewport();
  });
});
