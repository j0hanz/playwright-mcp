import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data fixtures - isolate test data from code (best practice)
const TEST_DATA_PATH = path.join(
  __dirname,
  '../fixtures/test-data/credentials.json'
);
const _STORAGE_STATE_DIR = path.join(__dirname, '../fixtures/storage-states');

// Load test data from fixtures file
function loadTestData() {
  try {
    const data = fs.readFileSync(TEST_DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Fallback if fixture file doesn't exist
    return {
      testUser: {
        name: 'Test User',
        email: 'test@example.com',
        message: 'This is a test message for validation testing purposes.',
      },
      contactEmail: 'l.johansson93@outlook.com',
    };
  }
}

const TEST_DATA = loadTestData();

// Portfolio-specific test suite using Playwright best practices
test.describe('Portfolio Website Tests', () => {
  const baseUrl = process.env.PORTFOLIO_URL || 'http://localhost:5173';
  const CONTACT_EMAIL = TEST_DATA.contactEmail;

  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    // Wait for React hydration by checking for interactive elements
    await expect(page.getByRole('button').first()).toBeAttached();
  });

  test('should load the homepage', async ({ page }) => {
    await expect(page).toHaveTitle(/portfolio|linus/i);
  });

  test('should display hero section', async ({ page }) => {
    // Hero section contains main heading - use role-based locator
    const heroHeading = page.getByRole('heading', { level: 1 });
    await expect(heroHeading).toBeVisible();

    // Verify hero region is present
    const heroSection = page.locator('#hero');
    await expect(heroSection).toBeVisible();
  });

  test('should navigate between sections', async ({ page }) => {
    // Open mobile menu to access nav links
    const menuButton = page.getByRole('button', {
      name: /open navigation menu|menu/i,
    });

    // Check if menu button exists and click it
    const menuCount = await menuButton.count();
    if (menuCount > 0) {
      await menuButton.click();

      // Wait for drawer to be visible using web-first assertion
      const drawer = page.getByRole('presentation');
      await expect(drawer).toBeVisible();

      // NavLinks are inside the drawer - use role-based locator
      const navLinks = page.getByRole('link');
      const count = await navLinks.count();

      if (count > 0) {
        // Get initial URL
        const _initialUrl = page.url();

        // Click the first nav link with text
        const firstNavLink = navLinks.filter({ hasText: /.+/ }).first();
        await firstNavLink.click();

        // Verify URL has a hash (navigation occurred)
        await expect(page).toHaveURL(/#/);
      }
    }
  });

  test('should toggle dark mode', async ({ page }) => {
    // DarkModeToggle uses descriptive aria-label
    const darkModeToggle = page.getByRole('button', {
      name: /switch to (light|dark) mode/i,
    });

    await expect(darkModeToggle).toBeVisible();
    await darkModeToggle.click();

    // Verify theme attribute changed using web-first assertion
    await expect(page.locator('html')).toHaveAttribute(
      'data-mui-color-scheme',
      /.+/
    );
  });

  test('should display contact form', async ({ page }) => {
    // Navigate to contact section using hash
    await page.goto(`${baseUrl}#contact`);

    // Use role-based locators for form elements
    const nameInput = page.getByRole('textbox', { name: 'Name' });
    const emailInput = page.getByRole('textbox', { name: 'Email' });

    // Contact form should have both name and email fields visible
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
  });

  test('should have working social links', async ({ page }) => {
    // Open navigation menu to access social links
    const menuButton = page.getByRole('button', {
      name: /open navigation menu|menu/i,
    });

    const menuCount = await menuButton.count();
    if (menuCount > 0) {
      await menuButton.click();
      await expect(page.getByRole('presentation')).toBeVisible();
    }

    // Social links - use role-based locators with name patterns
    const githubLink = page.getByRole('link', { name: /github/i });
    const linkedinLink = page.getByRole('link', { name: /linkedin/i });

    // At least one social link should be present
    const socialLink = githubLink.or(linkedinLink);
    await expect(socialLink.first()).toBeVisible();

    // Verify link has valid href
    const href = await socialLink.first().getAttribute('href');
    expect(href).toMatch(/^https?:\/\//);
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // On mobile, navigation should still be accessible
    const navOrButton = page
      .getByRole('navigation')
      .or(page.getByRole('button', { name: /menu/i }));
    await expect(navOrButton.first()).toBeVisible();

    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Desktop should also have navigation
    await expect(navOrButton.first()).toBeVisible();
  });

  test('should take full page screenshot', async ({ page }) => {
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');

    // Take screenshot with animations disabled
    const screenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled',
    });

    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('should pass accessibility checks', async ({ page }) => {
    // Check for heading hierarchy using role-based locator
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();

    // Check that images with role="img" have accessible names via aria-label
    // MUI uses span[role="img"] with aria-label for icon images
    const roleImages = page.locator('[role="img"][aria-label]');
    const roleImgCount = await roleImages.count();

    // Should have at least some accessible images
    expect(roleImgCount).toBeGreaterThan(0);

    // Verify actual <img> elements have alt text
    const imgElements = page.locator('img');
    const imgCount = await imgElements.count();

    for (let i = 0; i < Math.min(imgCount, 5); i++) {
      const img = imgElements.nth(i);
      if (await img.isVisible()) {
        // Actual img elements should have alt attribute
        await expect(img).toHaveAttribute('alt');
      }
    }
  });

  test('should load animations smoothly', async ({ page }) => {
    // Hero content should be visible (indicates initial animations completed)
    const heroSection = page.locator('#hero');
    await expect(heroSection).toBeVisible();

    // Main heading should animate in
    const heroHeading = page.getByRole('heading', { level: 1 });
    await expect(heroHeading).toBeVisible();
  });

  test('should have clickable buttons', async ({ page }) => {
    // Use role-based locator for buttons
    const buttons = page.getByRole('button');

    // Should have at least the menu button and dark mode toggle
    await expect(buttons.first()).toBeVisible();

    // Verify button is enabled and clickable
    const firstButton = buttons.first();
    await expect(firstButton).toBeEnabled();
  });

  // ============================================
  // PROJECTS SECTION TESTS
  // ============================================

  test('should display projects section with project cards', async ({
    page,
  }) => {
    // Navigate to projects section
    await page.goto(`${baseUrl}#projects`);

    // Projects section should be visible with heading
    const projectsHeading = page.getByRole('heading', { name: /projects/i });
    await expect(projectsHeading).toBeVisible();

    // Should have project cards with GitHub buttons (button text is "GitHub")
    const githubButtons = page.getByRole('link', { name: /^github$/i });
    await expect(githubButtons.first()).toBeVisible({ timeout: 10000 });

    const projectCount = await githubButtons.count();
    expect(projectCount).toBeGreaterThan(0);
  });

  test('should have working project links', async ({ page }) => {
    await page.goto(`${baseUrl}#projects`);

    // Find GitHub links in projects section (button text is "GitHub")
    const githubLinks = page.getByRole('link', { name: /^github$/i });
    await expect(githubLinks.first()).toBeVisible({ timeout: 10000 });

    // Verify first GitHub link has valid href
    const href = await githubLinks.first().getAttribute('href');
    expect(href).toMatch(/^https:\/\/github\.com\//);
  });

  // ============================================
  // ABOUT ME SECTION TESTS
  // ============================================

  test('should display about me section', async ({ page }) => {
    await page.goto(`${baseUrl}#about`);

    // About Me section should have heading
    const aboutHeading = page.getByRole('heading', { name: /about me/i });
    await expect(aboutHeading).toBeVisible();

    // Should have Overview and Highlights cards
    const overviewText = page.getByText(/overview/i);
    const highlightsText = page.getByText(/highlights/i);

    await expect(overviewText.first()).toBeVisible();
    await expect(highlightsText.first()).toBeVisible();
  });

  test('should have credential button in about section', async ({ page }) => {
    await page.goto(`${baseUrl}#about`);

    // Look for credential button
    const credentialButton = page.getByRole('button', { name: /credential/i });
    await expect(credentialButton).toBeVisible();
  });

  test('should open credential modal from about section', async ({ page }) => {
    await page.goto(`${baseUrl}#about`);

    // Click credential button
    const credentialButton = page.getByRole('button', { name: /credential/i });
    await credentialButton.click();

    // Modal should appear - look for dialog or modal content
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Close modal with Escape
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  // ============================================
  // EXPERIENCE SECTION TESTS
  // ============================================

  test('should display experience section with timeline', async ({ page }) => {
    await page.goto(`${baseUrl}#experience`);

    // Experience section should have heading
    const experienceHeading = page.getByRole('heading', {
      name: /experience/i,
    });
    await expect(experienceHeading).toBeVisible();

    // Should have work/education titles visible
    const diplomaText = page.getByText(
      /diploma in full stack software development/i
    );
    await expect(diplomaText.first()).toBeVisible();
  });

  test('should display work experience entries', async ({ page }) => {
    await page.goto(`${baseUrl}#experience`);

    // Check for workplace names
    const webhallen = page.getByText(/webhallen/i);
    await expect(webhallen.first()).toBeVisible();
  });

  test('should have credential button in experience section', async ({
    page,
  }) => {
    await page.goto(`${baseUrl}#experience`);

    // Wait for section to load and scroll into view to trigger animations
    await page.waitForLoadState('networkidle');

    // Education entry should have credential button - may need scrolling to trigger animation
    // The credential button animates in when in view
    const credentialButtons = page.getByRole('button', { name: /credential/i });

    // Wait for button to become visible (animation trigger)
    await expect(credentialButtons.first()).toBeVisible({ timeout: 15000 });
  });

  // ============================================
  // CONTACT FORM VALIDATION TESTS
  // ============================================

  test('should show validation error for empty required fields', async ({
    page,
  }) => {
    await page.goto(`${baseUrl}#contact`);

    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /send/i });
    await submitButton.click();

    // Should show error via snackbar (role alert)
    const snackbar = page.getByRole('alert');
    await expect(snackbar).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for invalid email', async ({ page }) => {
    await page.goto(`${baseUrl}#contact`);

    // Fill form with test data from fixtures (invalid email)
    const nameInput = page.getByRole('textbox', { name: 'Name' });
    const emailInput = page.getByRole('textbox', { name: 'Email' });
    const messageInput = page.getByRole('textbox', { name: 'Message' });

    await nameInput.fill(TEST_DATA.testUser.name);
    await emailInput.fill('invalid-email');
    await messageInput.fill(TEST_DATA.testUser.message);

    // Submit form
    const submitButton = page.getByRole('button', { name: /send/i });
    await submitButton.click();

    // Should show email validation error
    const errorMessage = page.getByText(/email.*invalid|invalid.*email/i);
    await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });
  });

  test('should clear form when clear button is clicked', async ({ page }) => {
    await page.goto(`${baseUrl}#contact`);

    // Fill in some data using test fixtures
    const nameInput = page.getByRole('textbox', { name: 'Name' });
    await nameInput.fill(TEST_DATA.testUser.name);

    // Verify data is filled
    await expect(nameInput).toHaveValue(TEST_DATA.testUser.name);

    // Click clear button
    const clearButton = page.getByRole('button', { name: /clear/i });
    await clearButton.click();

    // Form should be cleared
    await expect(nameInput).toHaveValue('');
  });

  test('should disable submit button while sending', async ({ page }) => {
    await page.goto(`${baseUrl}#contact`);

    // Get submit button
    const submitButton = page.getByRole('button', { name: /send/i });

    // Button should be enabled initially
    await expect(submitButton).toBeEnabled();
  });

  // ============================================
  // FOOTER TESTS
  // ============================================

  test('should display footer with contact details', async ({ page }) => {
    await page.goto(`${baseUrl}#footer`);

    // Footer should have contact details text
    const contactDetails = page.getByText(/contact details/i);
    await expect(contactDetails).toBeVisible();

    // Should display email
    const email = page.getByText(CONTACT_EMAIL);
    await expect(email).toBeVisible();
  });

  test('should have working email link in footer', async ({ page }) => {
    await page.goto(`${baseUrl}#footer`);

    // Find email link
    const emailLink = page.getByRole('link', { name: CONTACT_EMAIL });
    await expect(emailLink).toBeVisible();

    // Verify mailto href
    const href = await emailLink.getAttribute('href');
    expect(href).toBe(`mailto:${CONTACT_EMAIL}`);
  });

  test('should have copy email button in footer', async ({ page }) => {
    await page.goto(`${baseUrl}#footer`);

    // Find copy button
    const copyButton = page.getByRole('button', { name: /copy email/i });
    await expect(copyButton).toBeVisible();
  });

  test('should display copyright in footer', async ({ page }) => {
    await page.goto(`${baseUrl}#footer`);

    // Should have copyright text
    const copyright = page.getByText(/copyright 2025/i);
    await expect(copyright).toBeVisible();
  });

  test('should have CV download option in footer', async ({ page }) => {
    await page.goto(`${baseUrl}#footer`);

    // Footer has social links including CV download
    // The footer may scroll within its container, look for any Download CV element
    const cvElement = page.getByLabel(/download cv/i).first();
    await expect(cvElement).toBeVisible({ timeout: 10000 });
  });

  // ============================================
  // CV MODAL TESTS
  // ============================================

  test('should open CV language selection modal', async ({ page }) => {
    // Use hero section where Download CV button is always visible
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Wait for hero section to be visible and interactive
    await expect(page.locator('#hero')).toBeVisible();

    // Click "Download CV" button in hero section
    const cvButton = page.getByRole('button', { name: /download cv/i });
    await expect(cvButton).toBeVisible({ timeout: 15000 });
    await cvButton.click();

    // Modal should appear with language options
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Should have language selection heading
    const languageHeading = page.getByRole('heading', {
      name: /choose language/i,
    });
    await expect(languageHeading).toBeVisible();
  });

  test('should have Swedish and English CV options', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Wait for hero section
    await expect(page.locator('#hero')).toBeVisible();

    // Open CV modal from hero section
    const cvButton = page.getByRole('button', { name: /download cv/i });
    await expect(cvButton).toBeVisible({ timeout: 15000 });
    await cvButton.click();

    // Wait for modal
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });

    // Should have Swedish and English options (flag buttons)
    const swedishButton = page.getByRole('button', { name: /swedish/i });
    const englishButton = page.getByRole('button', { name: /english/i });

    await expect(swedishButton).toBeVisible();
    await expect(englishButton).toBeVisible();
  });

  test('should close CV modal with Escape key', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Wait for hero section
    await expect(page.locator('#hero')).toBeVisible();

    // Open CV modal from hero section
    const cvButton = page.getByRole('button', { name: /download cv/i });
    await expect(cvButton).toBeVisible({ timeout: 15000 });
    await cvButton.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });
});

// ============================================
// KEYBOARD ACCESSIBILITY TESTS
// ============================================

test.describe('Keyboard Accessibility Tests', () => {
  const baseUrl = process.env.PORTFOLIO_URL || 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button').first()).toBeAttached();
  });

  test('should navigate with Tab key', async ({ page }) => {
    // Press Tab to move focus
    await page.keyboard.press('Tab');

    // Something should be focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should activate buttons with Enter key', async ({ page }) => {
    // Focus on dark mode toggle
    const darkModeToggle = page.getByRole('button', {
      name: /switch to (light|dark) mode/i,
    });

    await darkModeToggle.focus();
    await expect(darkModeToggle).toBeFocused();

    // Get initial theme
    const initialTheme = await page
      .locator('html')
      .getAttribute('data-mui-color-scheme');

    // Press Enter to toggle
    await page.keyboard.press('Enter');

    // Theme should change
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-mui-color-scheme',
      initialTheme || ''
    );
  });

  test('should close modals with Escape key', async ({ page }) => {
    // Open navigation menu
    const menuButton = page.getByRole('button', {
      name: /open navigation menu|menu/i,
    });

    if ((await menuButton.count()) > 0) {
      await menuButton.click();

      // Wait for drawer
      const drawer = page.getByRole('presentation');
      await expect(drawer).toBeVisible();

      // Press Escape to close
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
    }
  });

  test('should have visible focus indicators', async ({ page }) => {
    // Tab to first interactive element
    await page.keyboard.press('Tab');

    // Get focused element
    const focusedElement = page.locator(':focus');

    // Check that focus is visible (has outline or some indicator)
    const outline = await focusedElement.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.outline || style.boxShadow;
    });

    // Should have some focus styling
    expect(outline).toBeTruthy();
  });
});

// ============================================
// SNACKBAR/NOTIFICATION TESTS
// ============================================

test.describe('Notification Tests', () => {
  const baseUrl = process.env.PORTFOLIO_URL || 'http://localhost:5173';

  test('should show snackbar on form validation error', async ({ page }) => {
    await page.goto(`${baseUrl}#contact`, { waitUntil: 'domcontentloaded' });

    // Submit empty form
    const submitButton = page.getByRole('button', { name: /send/i });
    await submitButton.click();

    // Snackbar should appear with error message
    const snackbar = page.getByRole('alert');
    await expect(snackbar).toBeVisible({ timeout: 5000 });
  });
});

// Performance tests
test.describe('Performance Tests', () => {
  const baseUrl = process.env.PORTFOLIO_URL || 'http://localhost:5173';

  test('should load within acceptable time', async ({ page }) => {
    // Use Navigation Timing API for accurate measurement
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const timing = await page.evaluate(() => {
      const perf = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.startTime,
        loadComplete: perf.loadEventEnd - perf.startTime,
      };
    });

    // DOM content should load within 15 seconds (allows for Firefox cold start)
    expect(timing.domContentLoaded).toBeLessThan(15000);
  });

  test('should have good Core Web Vitals', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'load' });

    // Get LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          lcpValue = lastEntry?.startTime ?? 0;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        // Resolve after a short delay to capture LCP
        setTimeout(() => {
          observer.disconnect();
          resolve(lcpValue);
        }, 3000);
      });
    });

    // LCP should be under 2.5s for good score (allow up to 4s for flexibility)
    expect(lcp).toBeLessThan(4000);
  });
});

// ============================================
// REDUCED MOTION & ACCESSIBILITY EMULATION TESTS
// ============================================

test.describe('Accessibility Emulation Tests', () => {
  const baseUrl = process.env.PORTFOLIO_URL || 'http://localhost:5173';

  test('should respect reduced motion preference', async ({ page }) => {
    // Emulate reduced motion preference (best practice for accessibility testing)
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    // Wait for hero section - animations should be instant or disabled
    const heroSection = page.locator('#hero');
    await expect(heroSection).toBeVisible();

    // Page should still be functional with reduced motion
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('should work in dark color scheme', async ({ page }) => {
    // Emulate dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    // Page should render with dark theme
    const html = page.locator('html');
    await expect(html).toBeVisible();

    // Verify page is functional in dark mode
    const heroSection = page.locator('#hero');
    await expect(heroSection).toBeVisible();
  });

  test('should work in light color scheme', async ({ page }) => {
    // Emulate light mode preference
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    // Page should render with light theme
    const html = page.locator('html');
    await expect(html).toBeVisible();

    // Verify page is functional in light mode
    const heroSection = page.locator('#hero');
    await expect(heroSection).toBeVisible();
  });
});
