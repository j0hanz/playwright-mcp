// Page Actions - High-level Playwright wrapper functions
// @see https://playwright.dev/docs/locators, https://playwright.dev/docs/best-practices

import type { Page } from 'playwright';

import { timeoutOptions } from '../config/playwright-config.js';
import type {
  AriaRole,
  KeyModifier,
  MouseButton,
  WaitUntilState,
} from '../types/index.js';

// Navigation Actions

export async function navigateTo(
  page: Page,
  url: string,
  options: { waitUntil?: WaitUntilState; timeout?: number } = {}
): Promise<{ url: string; title: string }> {
  const { waitUntil = 'load', timeout = timeoutOptions.navigation } = options;

  await page.goto(url, { waitUntil, timeout });

  return {
    url: page.url(),
    title: await page.title(),
  };
}

export async function navigateBack(
  page: Page,
  options: { timeout?: number } = {}
): Promise<{ url: string }> {
  const { timeout = timeoutOptions.navigation } = options;

  await page.goBack({ timeout });

  return { url: page.url() };
}

export async function navigateForward(
  page: Page,
  options: { timeout?: number } = {}
): Promise<{ url: string }> {
  const { timeout = timeoutOptions.navigation } = options;

  await page.goForward({ timeout });

  return { url: page.url() };
}

export async function reload(
  page: Page,
  options: { waitUntil?: WaitUntilState; timeout?: number } = {}
): Promise<{ url: string; title: string }> {
  const { waitUntil = 'load', timeout = timeoutOptions.navigation } = options;

  await page.reload({ waitUntil, timeout });

  return {
    url: page.url(),
    title: await page.title(),
  };
}

// Element Interaction Actions

export async function clickElement(
  page: Page,
  selector: string,
  options: {
    force?: boolean;
    button?: MouseButton;
    clickCount?: number;
    modifiers?: KeyModifier[];
    delay?: number;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action, ...clickOptions } = options;

  await page.locator(selector).click({ ...clickOptions, timeout });

  return { success: true };
}

export async function clickByRole(
  page: Page,
  role: AriaRole,
  options: {
    name?: string;
    exact?: boolean;
    force?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { name, exact, force, timeout = timeoutOptions.action } = options;

  const locator = page.getByRole(role, { name, exact });
  await locator.click({ force, timeout });

  return { success: true };
}

export async function clickByText(
  page: Page,
  text: string,
  options: {
    exact?: boolean;
    force?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { exact, force, timeout = timeoutOptions.action } = options;

  const locator = page.getByText(text, { exact });
  await locator.click({ force, timeout });

  return { success: true };
}

export async function clickByTestId(
  page: Page,
  testId: string,
  options: {
    force?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { force, timeout = timeoutOptions.action } = options;

  const locator = page.getByTestId(testId);
  await locator.click({ force, timeout });

  return { success: true };
}

export async function fillInput(
  page: Page,
  selector: string,
  text: string,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action } = options;

  await page.fill(selector, text, { timeout });

  return { success: true };
}

export async function fillByLabel(
  page: Page,
  label: string,
  text: string,
  options: {
    exact?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { exact, timeout = timeoutOptions.action } = options;

  const locator = page.getByLabel(label, { exact });
  await locator.fill(text, { timeout });

  return { success: true };
}

export async function fillByPlaceholder(
  page: Page,
  placeholder: string,
  text: string,
  options: {
    exact?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { exact, timeout = timeoutOptions.action } = options;

  const locator = page.getByPlaceholder(placeholder, { exact });
  await locator.fill(text, { timeout });

  return { success: true };
}

export async function hoverElement(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action } = options;

  await page.hover(selector, { timeout });

  return { success: true };
}

export async function selectOption(
  page: Page,
  selector: string,
  value: string | string[],
  options: { timeout?: number } = {}
): Promise<{ success: boolean; selected: string[] }> {
  const { timeout = timeoutOptions.action } = options;

  const selected = await page.selectOption(selector, value, { timeout });

  return { success: true, selected };
}

export async function setChecked(
  page: Page,
  selector: string,
  checked: boolean,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action } = options;

  await page.setChecked(selector, checked, { timeout });

  return { success: true };
}

// Keyboard Actions

export async function pressKey(
  page: Page,
  key: string,
  options: { delay?: number } = {}
): Promise<{ success: boolean }> {
  await page.keyboard.press(key, options);

  return { success: true };
}

export async function typeText(
  page: Page,
  text: string,
  options: { delay?: number } = {}
): Promise<{ success: boolean }> {
  await page.keyboard.type(text, options);

  return { success: true };
}

// Mouse Actions

export async function moveMouse(
  page: Page,
  x: number,
  y: number,
  options: { steps?: number } = {}
): Promise<{ success: boolean }> {
  await page.mouse.move(x, y, options);

  return { success: true };
}

export async function clickAt(
  page: Page,
  x: number,
  y: number,
  options: {
    button?: MouseButton;
    clickCount?: number;
    delay?: number;
  } = {}
): Promise<{ success: boolean }> {
  await page.mouse.click(x, y, options);

  return { success: true };
}

export async function dragAndDrop(
  page: Page,
  source: string,
  target: string,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action } = options;

  await page.dragAndDrop(source, target, { timeout });

  return { success: true };
}

// Wait Actions

export async function waitForSelector(
  page: Page,
  selector: string,
  options: {
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
    timeout?: number;
  } = {}
): Promise<{ found: boolean }> {
  const { state = 'visible', timeout = timeoutOptions.action } = options;

  try {
    // Use locator.waitFor() as recommended by Playwright docs
    await page.locator(selector).waitFor({ state, timeout });
    return { found: true };
  } catch {
    return { found: false };
  }
}

export async function waitForNavigation(
  page: Page,
  options: {
    url?: string | RegExp;
    waitUntil?: WaitUntilState;
    timeout?: number;
  } = {}
): Promise<{ url: string }> {
  const { timeout = timeoutOptions.navigation, ...waitOptions } = options;

  await page.waitForURL(waitOptions.url ?? '**/*', { timeout, ...waitOptions });

  return { url: page.url() };
}

export async function waitForLoadState(
  page: Page,
  state: 'load' | 'domcontentloaded' | 'networkidle' = 'load',
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.navigation } = options;

  await page.waitForLoadState(state, { timeout });

  return { success: true };
}

// Page Content Actions

export async function getContent(
  page: Page
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    page.content(),
    page.innerText('body').catch(() => ''),
  ]);

  return { html, text };
}

export async function takeScreenshot(
  page: Page,
  options: {
    path?: string;
    fullPage?: boolean;
    type?: 'png' | 'jpeg';
    quality?: number;
  } = {}
): Promise<{ base64?: string; path?: string }> {
  const buffer = await page.screenshot(options);

  return {
    base64: buffer.toString('base64'),
    path: options.path,
  };
}

export async function generatePdf(
  page: Page,
  options: {
    path?: string;
    format?: 'A4' | 'Letter' | 'Legal';
    landscape?: boolean;
    printBackground?: boolean;
  } = {}
): Promise<{ base64?: string; path?: string }> {
  const buffer = await page.pdf(options);

  return {
    base64: buffer.toString('base64'),
    path: options.path,
  };
}

export async function evaluate<T>(
  page: Page,
  script: string | ((arg: unknown) => T),
  arg?: unknown
): Promise<{ result: T }> {
  const result = await page.evaluate(script as (arg: unknown) => T, arg);

  return { result };
}

// Element Info Actions

export async function getElementInfo(
  page: Page,
  selector: string
): Promise<Record<string, unknown> | null> {
  const locator = page.locator(selector).first();

  if ((await locator.count()) === 0) return null;

  const [tagName, textContent, attributes, boundingBox, isVisible, isEnabled] =
    await Promise.all([
      locator.evaluate((el: Element) => el.tagName.toLowerCase()),
      locator.textContent(),
      locator.evaluate((el: Element) => {
        const attrs: Record<string, string> = {};
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes.item(i);
          if (attr) {
            attrs[attr.name] = attr.value;
          }
        }
        return attrs;
      }),
      locator.boundingBox(),
      locator.isVisible(),
      locator.isEnabled(),
    ]);

  return {
    tagName,
    textContent: textContent?.trim() ?? '',
    attributes,
    boundingBox,
    isVisible,
    isEnabled,
  };
}

export async function getElementCount(
  page: Page,
  selector: string
): Promise<{ count: number }> {
  const locator = page.locator(selector);
  const count = await locator.count();

  return { count };
}
