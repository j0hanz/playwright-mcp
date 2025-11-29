/**
 * Portfolio Page - Page Object Model Example
 *
 * This demonstrates the Page Object Model (POM) pattern as recommended
 * by Playwright best practices. POMs encapsulate page structure and
 * interactions, making tests more maintainable and readable.
 *
 * @see https://playwright.dev/docs/pom
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page Object Model for a portfolio website.
 *
 * Usage:
 * ```typescript
 * const portfolioPage = new PortfolioPage(page);
 * await portfolioPage.goto();
 * await portfolioPage.navigateToSection('projects');
 * await expect(portfolioPage.projectCards).toHaveCount(6);
 * ```
 */
export class PortfolioPage {
  // Page reference
  readonly page: Page;

  // Header elements
  readonly header: Locator;
  readonly logo: Locator;
  readonly navLinks: Locator;
  readonly themeToggle: Locator;

  // Hero section
  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly heroSubtitle: Locator;
  readonly ctaButton: Locator;

  // Projects section
  readonly projectsSection: Locator;
  readonly projectCards: Locator;
  readonly projectTitles: Locator;
  readonly projectLinks: Locator;

  // Skills section
  readonly skillsSection: Locator;
  readonly skillBadges: Locator;

  // Contact section
  readonly contactSection: Locator;
  readonly contactForm: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly messageInput: Locator;
  readonly submitButton: Locator;

  // Footer
  readonly footer: Locator;
  readonly socialLinks: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header - Using role-based locators (recommended)
    this.header = page.getByRole('banner');
    this.logo = page.getByRole('link', { name: /logo|home/i });
    this.navLinks = page.getByRole('navigation').getByRole('link');
    this.themeToggle = page.getByRole('button', { name: /theme|dark|light/i });

    // Hero section
    this.heroSection = page
      .getByRole('region', { name: /hero/i })
      .or(page.locator('[data-testid="hero"]'));
    this.heroTitle = page.getByRole('heading', { level: 1 });
    this.heroSubtitle = page.locator(
      '.hero-subtitle, [data-testid="hero-subtitle"]'
    );
    this.ctaButton = page.getByRole('button', {
      name: /contact|hire|get in touch/i,
    });

    // Projects section
    this.projectsSection = page
      .getByRole('region', { name: /projects/i })
      .or(page.locator('#projects, [data-testid="projects"]'));
    this.projectCards = page
      .getByRole('article')
      .or(page.locator('[data-testid="project-card"]'));
    this.projectTitles = this.projectCards.getByRole('heading');
    this.projectLinks = this.projectCards.getByRole('link');

    // Skills section
    this.skillsSection = page
      .getByRole('region', { name: /skills/i })
      .or(page.locator('#skills, [data-testid="skills"]'));
    this.skillBadges = page.locator(
      '[data-testid="skill-badge"], .skill-badge'
    );

    // Contact section
    this.contactSection = page
      .getByRole('region', { name: /contact/i })
      .or(page.locator('#contact, [data-testid="contact"]'));
    this.contactForm = page.getByRole('form').or(page.locator('form'));
    this.nameInput = page
      .getByLabel(/name/i)
      .or(page.getByPlaceholder(/name/i));
    this.emailInput = page
      .getByLabel(/email/i)
      .or(page.getByPlaceholder(/email/i));
    this.messageInput = page
      .getByLabel(/message/i)
      .or(page.getByPlaceholder(/message/i));
    this.submitButton = page.getByRole('button', { name: /send|submit/i });

    // Footer
    this.footer = page.getByRole('contentinfo');
    this.socialLinks = this.footer.getByRole('link');
  }

  /**
   * Navigate to the portfolio homepage
   */
  async goto(baseUrl = '/') {
    await this.page.goto(baseUrl);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Navigate to a specific section by clicking nav link
   */
  async navigateToSection(
    section: 'about' | 'projects' | 'skills' | 'contact'
  ) {
    const navLink = this.navLinks.filter({ hasText: new RegExp(section, 'i') });
    await navLink.click();

    // Wait for smooth scroll to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Toggle dark/light theme
   */
  async toggleTheme() {
    await this.themeToggle.click();
  }

  /**
   * Get the current theme
   */
  async getCurrentTheme(): Promise<'light' | 'dark'> {
    const html = this.page.locator('html');
    const className = (await html.getAttribute('class')) ?? '';
    const dataTheme = (await html.getAttribute('data-theme')) ?? '';

    if (className.includes('dark') || dataTheme === 'dark') {
      return 'dark';
    }
    return 'light';
  }

  /**
   * Click the primary CTA button
   */
  async clickCTA() {
    await this.ctaButton.click();
  }

  /**
   * Get number of projects displayed
   */
  async getProjectCount(): Promise<number> {
    return this.projectCards.count();
  }

  /**
   * Click on a project card by title
   */
  async openProject(title: string) {
    const projectCard = this.projectCards.filter({ hasText: title });
    await projectCard.click();
  }

  /**
   * Get all project titles
   */
  async getProjectTitles(): Promise<string[]> {
    const titles = await this.projectTitles.allTextContents();
    return titles.map((t) => t.trim());
  }

  /**
   * Fill and submit the contact form
   */
  async submitContactForm(data: {
    name: string;
    email: string;
    message: string;
  }) {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);
    await this.messageInput.fill(data.message);
    await this.submitButton.click();
  }

  /**
   * Check if the contact form was submitted successfully
   */
  async isFormSubmissionSuccessful(): Promise<boolean> {
    const successMessage = this.page.getByText(/thank you|success|sent/i);
    return successMessage.isVisible({ timeout: 5000 }).catch(() => false);
  }

  /**
   * Get all skill badges text
   */
  async getSkills(): Promise<string[]> {
    const skills = await this.skillBadges.allTextContents();
    return skills.map((s) => s.trim());
  }

  /**
   * Verify the page loaded correctly
   */
  async verifyPageLoaded() {
    await expect(this.heroTitle).toBeVisible();
    await expect(this.header).toBeVisible();
  }

  /**
   * Get social media links
   */
  async getSocialLinks(): Promise<{ href: string; text: string }[]> {
    const links: { href: string; text: string }[] = [];
    const count = await this.socialLinks.count();

    for (let i = 0; i < count; i++) {
      const link = this.socialLinks.nth(i);
      links.push({
        href: (await link.getAttribute('href')) ?? '',
        text: (await link.textContent()) ?? '',
      });
    }

    return links;
  }
}

export default PortfolioPage;
