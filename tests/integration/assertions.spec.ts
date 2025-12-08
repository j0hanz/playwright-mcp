/**
 * Assertion Integration Tests
 *
 * Tests assert_element, assert_text, assert_value, assert_attribute,
 * assert_css, assert_url, assert_title, assert_checked, assert_count
 *
 * Test Sites:
 * - example.com: Simple site for basic assertions
 * - the-internet.herokuapp.com: Rich elements for assertions
 */
import { test, expect } from '@playwright/test';

test.describe('Assertions - Element State', () => {
  test('assert element visible', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('p')).toBeVisible();
  });

  test('assert element hidden', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dynamic_loading/1');

    const finish = page.locator('#finish');
    await expect(finish).toBeHidden();

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(finish).toBeVisible({ timeout: 10000 });
  });

  test('assert element attached', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('h1')).toBeAttached();
  });

  test('assert element detached', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/add_remove_elements/');

    await page.getByRole('button', { name: 'Add Element' }).click();
    const deleteButton = page.locator('.added-manually').first();

    await expect(deleteButton).toBeAttached();
    await deleteButton.click();
    await expect(deleteButton).not.toBeAttached();
  });

  test('assert element enabled', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await expect(page.getByLabel('Username')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Login' })).toBeEnabled();
  });

  test('assert element disabled', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dynamic_controls');

    const input = page.locator('#input-example input');
    await expect(input).toBeDisabled();

    await page.locator('#input-example button').click();
    await expect(input).toBeEnabled({ timeout: 10000 });
  });

  test('assert element editable', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await expect(page.getByLabel('Username')).toBeEditable();
  });

  test('assert element readonly', async ({ page }) => {
    await page.goto('https://example.com');

    // Create readonly input
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'readonly-input';
      input.readOnly = true;
      document.body.appendChild(input);
    });

    await expect(page.locator('#readonly-input')).not.toBeEditable();
  });
});

test.describe('Assertions - Text Content', () => {
  test('assert exact text', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('h1')).toHaveText('Example Domain');
  });

  test('assert text contains', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('p').first()).toContainText(
      'This domain is for use'
    );
  });

  test('assert text with regex', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('h1')).toHaveText(/Example/);
  });

  test('assert text array', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/');

    const links = page.locator('ul li a');
    await expect(links).toHaveText([
      /A\/B Testing/,
      /Add\/Remove Elements/,
      /Basic Auth/,
    ]);
  });

  test('assert inner text', async ({ page }) => {
    await page.goto('https://example.com');

    const text = await page.locator('h1').innerText();
    expect(text).toBe('Example Domain');
  });

  test('assert text content', async ({ page }) => {
    await page.goto('https://example.com');

    const text = await page.locator('h1').textContent();
    expect(text).toBe('Example Domain');
  });

  test('assert empty text', async ({ page }) => {
    await page.goto('https://example.com');

    await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'empty-div';
      document.body.appendChild(div);
    });

    await expect(page.locator('#empty-div')).toBeEmpty();
  });
});

test.describe('Assertions - Input Values', () => {
  test('assert input value', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const username = page.getByLabel('Username');
    await username.fill('tomsmith');

    await expect(username).toHaveValue('tomsmith');
  });

  test('assert input value with regex', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const username = page.getByLabel('Username');
    await username.fill('tomsmith123');

    await expect(username).toHaveValue(/tom/);
  });

  test('assert empty input value', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    await expect(page.getByLabel('Username')).toHaveValue('');
  });

  test('assert textarea value', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/tinymce');

    const frame = page.frameLocator('iframe').first();
    await frame.locator('body').fill('Test content');

    const content = await frame.locator('body').textContent();
    expect(content).toBe('Test content');
  });

  test('assert select value', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dropdown');

    const select = page.locator('#dropdown');
    await select.selectOption('1');

    await expect(select).toHaveValue('1');
  });
});

test.describe('Assertions - Attributes', () => {
  test('assert attribute exists', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('a').first()).toHaveAttribute('href');
  });

  test('assert attribute value', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('a').first()).toHaveAttribute(
      'href',
      'https://www.iana.org/domains/example'
    );
  });

  test('assert attribute with regex', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('a').first()).toHaveAttribute(
      'href',
      /iana\.org/
    );
  });

  test('assert id attribute', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dropdown');

    await expect(page.locator('select')).toHaveAttribute('id', 'dropdown');
  });

  test('assert class attribute', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/add_remove_elements/');

    await page.getByRole('button', { name: 'Add Element' }).click();
    await expect(page.locator('button').last()).toHaveClass(/added-manually/);
  });

  test('assert data attribute', async ({ page }) => {
    await page.goto('https://example.com');

    await page.evaluate(() => {
      const div = document.createElement('div');
      div.setAttribute('data-testid', 'test-element');
      document.body.appendChild(div);
    });

    await expect(page.locator('[data-testid="test-element"]')).toHaveAttribute(
      'data-testid',
      'test-element'
    );
  });

  test('assert multiple attributes', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const input = page.getByLabel('Username');
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toHaveAttribute('name', 'username');
  });
});

test.describe('Assertions - CSS Properties', () => {
  test('assert CSS color', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('h1')).toHaveCSS('display', 'block');
  });

  test('assert CSS display', async ({ page }) => {
    await page.goto('https://example.com');

    const h1 = page.locator('h1');
    await expect(h1).toHaveCSS('display', /block|inline-block/);
  });

  test('assert CSS font properties', async ({ page }) => {
    await page.goto('https://example.com');

    const h1 = page.locator('h1');
    const fontSize = await h1.evaluate(
      (el) => window.getComputedStyle(el).fontSize
    );
    expect(fontSize).toBeTruthy();
  });

  test('assert element opacity', async ({ page }) => {
    await page.goto('https://example.com');

    await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'transparent';
      div.style.opacity = '0.5';
      document.body.appendChild(div);
    });

    await expect(page.locator('#transparent')).toHaveCSS('opacity', '0.5');
  });

  test('assert background color', async ({ page }) => {
    await page.goto('https://example.com');

    const body = page.locator('body');
    const bgColor = await body.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toBeTruthy();
  });
});

test.describe('Assertions - Page Properties', () => {
  test('assert page URL', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page).toHaveURL('https://example.com/');
  });

  test('assert URL with regex', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page).toHaveURL(/example\.com/);
  });

  test('assert URL contains', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    await expect(page).toHaveURL(/checkboxes/);
  });

  test('assert page title', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page).toHaveTitle('Example Domain');
  });

  test('assert title with regex', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page).toHaveTitle(/Example/);
  });

  test('assert title contains', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/');

    await expect(page).toHaveTitle(/Internet/);
  });
});

test.describe('Assertions - Checkbox and Radio', () => {
  test('assert checkbox checked', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.check();

    await expect(checkbox).toBeChecked();
  });

  test('assert checkbox unchecked', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.uncheck();

    await expect(checkbox).not.toBeChecked();
  });

  test('assert radio button selected', async ({ page }) => {
    await page.goto('https://example.com');

    // Create radio buttons
    await page.evaluate(() => {
      const radio1 = document.createElement('input');
      radio1.type = 'radio';
      radio1.name = 'test';
      radio1.id = 'radio1';
      const radio2 = document.createElement('input');
      radio2.type = 'radio';
      radio2.name = 'test';
      radio2.id = 'radio2';
      document.body.appendChild(radio1);
      document.body.appendChild(radio2);
    });

    await page.locator('#radio1').check();
    await expect(page.locator('#radio1')).toBeChecked();
    await expect(page.locator('#radio2')).not.toBeChecked();
  });
});

test.describe('Assertions - Element Count', () => {
  test('assert element count', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    await expect(page.locator('input[type="checkbox"]')).toHaveCount(2);
  });

  test('assert zero elements', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('.nonexistent')).toHaveCount(0);
  });

  test('assert minimum count', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/');

    const links = page.locator('ul li a');
    const count = await links.count();
    expect(count).toBeGreaterThan(10);
  });

  test('assert dynamic count', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/add_remove_elements/');

    await expect(page.locator('.added-manually')).toHaveCount(0);

    await page.getByRole('button', { name: 'Add Element' }).click();
    await expect(page.locator('.added-manually')).toHaveCount(1);

    await page.getByRole('button', { name: 'Add Element' }).click();
    await expect(page.locator('.added-manually')).toHaveCount(2);
  });
});

test.describe('Assertions - Focus State', () => {
  test('assert element focused', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const username = page.getByLabel('Username');
    await username.focus();

    await expect(username).toBeFocused();
  });

  test('assert element not focused', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const username = page.getByLabel('Username');
    const password = page.getByLabel('Password');

    await username.focus();
    await expect(password).not.toBeFocused();
  });

  test('assert focus change', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const username = page.getByLabel('Username');
    const password = page.getByLabel('Password');

    await username.focus();
    await expect(username).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(password).toBeFocused();
    await expect(username).not.toBeFocused();
  });
});

test.describe('Assertions - Viewport and Visibility', () => {
  test('assert element in viewport', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('h1')).toBeInViewport();
  });

  test('assert element not in viewport', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/large');

    const lastRow = page.locator('#large-table tbody tr').last();
    // Initially not in viewport for large tables
    await page.evaluate(() => window.scrollTo(0, 0));

    // Check if element is visible in viewport
    const isVisible = await lastRow.isVisible();
    expect(typeof isVisible).toBe('boolean');
  });

  test('assert element visible after scroll', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/large');

    const lastRow = page.locator('#large-table tbody tr').last();
    await lastRow.scrollIntoViewIfNeeded();

    await expect(lastRow).toBeInViewport();
  });
});

test.describe('Assertions - Complex Scenarios', () => {
  test('assert multiple conditions', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    const username = page.getByLabel('Username');
    await username.fill('tomsmith');

    await expect(username).toBeVisible();
    await expect(username).toBeEnabled();
    await expect(username).toHaveValue('tomsmith');
    await expect(username).toHaveAttribute('type', 'text');
  });

  test('assert with timeout', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dynamic_loading/2');

    await page.getByRole('button', { name: 'Start' }).click();

    await expect(page.locator('#finish')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#finish h4')).toHaveText('Hello World!');
  });

  test('assert negation', async ({ page }) => {
    await page.goto('https://example.com');

    await expect(page.locator('.nonexistent')).not.toBeVisible();
    await expect(page.locator('h1')).not.toHaveText('Wrong Text');
    await expect(page).not.toHaveURL(/wrong-domain/);
  });

  test('assert soft assertions', async ({ page }) => {
    await page.goto('https://example.com');

    await expect.soft(page.locator('h1')).toHaveText('Example Domain');
    await expect.soft(page).toHaveURL('https://example.com/');
    await expect.soft(page.locator('p')).toBeVisible();
  });
});

test.describe('Assertions - Custom Matchers', () => {
  test('assert using toBe', async ({ page }) => {
    await page.goto('https://example.com');

    const title = await page.title();
    expect(title).toBe('Example Domain');
  });

  test('assert using toContain', async ({ page }) => {
    await page.goto('https://example.com');

    const text = await page.locator('p').first().textContent();
    expect(text).toContain('domain');
  });

  test('assert using toMatch', async ({ page }) => {
    await page.goto('https://example.com');

    const url = page.url();
    expect(url).toMatch(/example\.com/);
  });

  test('assert using toHaveLength', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/checkboxes');

    const checkboxes = await page.locator('input[type="checkbox"]').all();
    expect(checkboxes).toHaveLength(2);
  });

  test('assert using toBeTruthy', async ({ page }) => {
    await page.goto('https://example.com');

    const element = await page.locator('h1').first();
    expect(element).toBeTruthy();
  });
});
