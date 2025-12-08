/**
 * Network Integration Tests
 *
 * Tests network_route, network_unroute for mocking, blocking, and modifying requests
 *
 * Test Sites:
 * - httpbin.org: Perfect for network testing with various endpoints
 */
import { test, expect } from '@playwright/test';

test.describe('Network - Route Mocking', () => {
  test('mock API response', async ({ page }) => {
    await page.route('**/get', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mocked: true, data: 'test' }),
      });
    });

    await page.goto('https://httpbin.org/get');
    const content = await page.textContent('body');
    expect(content).toContain('mocked');
  });

  test('mock with custom status code', async ({ page }) => {
    await page.route('**/status/404', (route) => {
      route.fulfill({
        status: 200,
        body: 'Mocked success',
      });
    });

    const response = await page.goto('https://httpbin.org/status/404');
    expect(response?.status()).toBe(200);
  });

  test('mock multiple endpoints', async ({ page }) => {
    await page.route('**/get', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ endpoint: 'get' }),
      });
    });

    await page.route('**/post', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ endpoint: 'post' }),
      });
    });

    await page.goto('https://httpbin.org/get');
    const content = await page.textContent('body');
    expect(content).toContain('get');
  });

  test('mock with custom headers', async ({ page }) => {
    await page.route('**/headers', (route) => {
      route.fulfill({
        status: 200,
        headers: {
          'X-Custom-Header': 'CustomValue',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ custom: 'headers' }),
      });
    });

    const response = await page.goto('https://httpbin.org/headers');
    expect(response?.status()).toBe(200);
  });

  test('mock with delay', async ({ page }) => {
    await page.route('**/delay/1', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        status: 200,
        body: 'Delayed response',
      });
    });

    const startTime = Date.now();
    await page.goto('https://httpbin.org/delay/1');
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(100);
  });
});

test.describe('Network - Request Blocking', () => {
  test('block specific request', async ({ page }) => {
    await page.route('**/image/png', (route) => route.abort());

    await page.goto('https://httpbin.org/');

    // Navigate to image endpoint
    const response = await page
      .goto('https://httpbin.org/image/png')
      .catch(() => null);
    expect(response).toBeNull();
  });

  test('block by resource type', async ({ page }) => {
    await page.route('**/*', (route) => {
      if (route.request().resourceType() === 'image') {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto('https://httpbin.org/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('block third-party requests', async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (!url.includes('httpbin.org')) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto('https://httpbin.org/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('block with abort reason', async ({ page }) => {
    await page.route('**/status/500', (route) => {
      route.abort('failed');
    });

    const response = await page
      .goto('https://httpbin.org/status/500')
      .catch(() => null);
    expect(response).toBeNull();
  });
});

test.describe('Network - Request Modification', () => {
  test('modify request headers', async ({ page }) => {
    await page.route('**/headers', (route) => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'X-Custom-Header': 'ModifiedValue',
        },
      });
    });

    await page.goto('https://httpbin.org/headers');
    const content = await page.textContent('body');
    expect(content).toContain('ModifiedValue');
  });

  test('modify request method', async ({ page }) => {
    await page.route('**/get', (route) => {
      route.continue({
        method: 'POST',
      });
    });

    await page.goto('https://httpbin.org/get');
    // Server will respond differently to POST
  });

  test('modify POST data', async ({ page }) => {
    await page.goto('https://httpbin.org/');

    await page.route('**/post', (route) => {
      route.continue({
        postData: JSON.stringify({ modified: true }),
      });
    });

    // Trigger POST request
    await page.evaluate(() => {
      fetch('/post', {
        method: 'POST',
        body: JSON.stringify({ original: true }),
      });
    });

    await page.waitForTimeout(500);
  });

  test('modify request URL', async ({ page }) => {
    await page.route('**/redirect-to*', (route) => {
      route.continue({
        url: 'https://httpbin.org/get',
      });
    });

    await page.goto('https://httpbin.org/redirect-to?url=https://example.com');
    await expect(page).toHaveURL(/get$/);
  });
});

test.describe('Network - Response Interception', () => {
  test('intercept and modify response', async ({ page }) => {
    await page.route('**/json', async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      await route.fulfill({
        response,
        body: JSON.stringify({ ...body, modified: true }),
      });
    });

    await page.goto('https://httpbin.org/json');
    const content = await page.textContent('body');
    expect(content).toContain('modified');
  });

  test('intercept and log response', async ({ page }) => {
    const responses: string[] = [];

    await page.route('**/get', async (route) => {
      const response = await route.fetch();
      responses.push(route.request().url());
      await route.fulfill({ response });
    });

    await page.goto('https://httpbin.org/get');
    expect(responses.length).toBeGreaterThan(0);
  });

  test('conditionally modify response', async ({ page }) => {
    await page.route('**/*', async (route) => {
      if (route.request().url().includes('/get')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ conditional: 'modified' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('https://httpbin.org/get');
    const content = await page.textContent('body');
    expect(content).toContain('conditional');
  });
});

test.describe('Network - Route Management', () => {
  test('unroute specific handler', async ({ page }) => {
    const handler = (route: import('@playwright/test').Route) => {
      route.fulfill({ body: 'Mocked' });
    };

    await page.route('**/get', handler);
    await page.unroute('**/get', handler);

    const response = await page.goto('https://httpbin.org/get');
    expect(response?.status()).toBe(200);
  });

  test('unroute all handlers', async ({ page }) => {
    await page.route('**/get', (route) => route.fulfill({ body: 'Mock 1' }));
    await page.route('**/json', (route) => route.fulfill({ body: 'Mock 2' }));

    await page.unrouteAll({ behavior: 'wait' });

    const response = await page.goto('https://httpbin.org/get');
    expect(response?.status()).toBe(200);
  });

  test('route priority', async ({ page }) => {
    // First route should take precedence
    await page.route('**/*', (route) => {
      route.fulfill({ body: 'First handler' });
    });

    await page.route('**/get', (route) => {
      route.fulfill({ body: 'Second handler' });
    });

    await page.goto('https://httpbin.org/get');
    const content = await page.textContent('body');
    expect(content).toContain('First handler');
  });

  test('route with times option', async ({ page }) => {
    let callCount = 0;

    await page.route(
      '**/get',
      (route) => {
        callCount++;
        route.fulfill({
          status: 200,
          body: JSON.stringify({ call: callCount }),
        });
      },
      { times: 1 }
    );

    await page.goto('https://httpbin.org/get');
    expect(callCount).toBe(1);
  });
});

test.describe('Network - Request Analysis', () => {
  test('inspect request details', async ({ page }) => {
    const requests: Array<{
      url: string;
      method: string;
      headers: Record<string, string>;
    }> = [];

    page.on('request', (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
      });
    });

    await page.goto('https://httpbin.org/get');

    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0].method).toBe('GET');
  });

  test('inspect response details', async ({ page }) => {
    const responses: Array<{
      url: string;
      status: number;
      headers: Record<string, string>;
    }> = [];

    page.on('response', (response) => {
      responses.push({
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
      });
    });

    await page.goto('https://httpbin.org/get');

    expect(responses.length).toBeGreaterThan(0);
    expect(responses[0].status).toBe(200);
  });

  test('wait for specific request', async ({ page }) => {
    const requestPromise = page.waitForRequest('**/get');

    await page.goto('https://httpbin.org/get');

    const request = await requestPromise;
    expect(request.url()).toContain('/get');
  });

  test('wait for specific response', async ({ page }) => {
    const responsePromise = page.waitForResponse('**/get');

    await page.goto('https://httpbin.org/get');

    const response = await responsePromise;
    expect(response.status()).toBe(200);
  });

  test('filter requests by resource type', async ({ page }) => {
    const documentRequests: string[] = [];

    page.on('request', (request) => {
      if (request.resourceType() === 'document') {
        documentRequests.push(request.url());
      }
    });

    await page.goto('https://httpbin.org/');

    expect(documentRequests.length).toBeGreaterThan(0);
  });
});

test.describe('Network - HAR Recording', () => {
  test('record network activity', async ({ browser }) => {
    const context = await browser.newContext({
      recordHar: { path: 'test-results/network.har' },
    });
    const page = await context.newPage();

    await page.goto('https://httpbin.org/get');

    await context.close();

    // HAR file should be created
    const fs = await import('fs');
    const harExists = fs.existsSync('test-results/network.har');
    expect(harExists).toBe(true);

    // Cleanup
    if (harExists) {
      fs.unlinkSync('test-results/network.har');
    }
  });

  test('record with URL filter', async ({ browser }) => {
    const context = await browser.newContext({
      recordHar: {
        path: 'test-results/network-filtered.har',
        urlFilter: '**/get',
      },
    });
    const page = await context.newPage();

    await page.goto('https://httpbin.org/get');

    await context.close();

    const fs = await import('fs');
    const harExists = fs.existsSync('test-results/network-filtered.har');
    expect(harExists).toBe(true);

    if (harExists) {
      fs.unlinkSync('test-results/network-filtered.har');
    }
  });
});

test.describe('Network - Error Scenarios', () => {
  test('handle network timeout', async ({ page }) => {
    await page.route('**/delay/10', (_route) => {
      // Don't fulfill or continue - simulate timeout
    });

    await expect(
      page.goto('https://httpbin.org/delay/10', {
        timeout: 1000,
      })
    ).rejects.toThrow();
  });

  test('handle connection refused', async ({ page }) => {
    await page.route('**/status/500', (route) => {
      route.abort('connectionrefused');
    });

    const response = await page
      .goto('https://httpbin.org/status/500')
      .catch(() => null);
    expect(response).toBeNull();
  });

  test('handle DNS error', async ({ page }) => {
    await page.route('**/get', (route) => {
      route.abort('namenotresolved');
    });

    const response = await page
      .goto('https://httpbin.org/get')
      .catch(() => null);
    expect(response).toBeNull();
  });

  test('simulate slow network', async ({ page }) => {
    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    const startTime = Date.now();
    await page.goto('https://httpbin.org/');
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(500);
  });
});

test.describe('Network - CORS and Security', () => {
  test('handle CORS headers', async ({ page }) => {
    await page.route('**/get', (route) => {
      route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cors: 'enabled' }),
      });
    });

    await page.goto('https://httpbin.org/get');
    const content = await page.textContent('body');
    expect(content).toContain('cors');
  });

  test('mock authentication', async ({ page }) => {
    await page.route('**/basic-auth/**', (route) => {
      const authHeader = route.request().headers()['authorization'];

      if (authHeader && authHeader.includes('Basic')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ authenticated: true }),
        });
      } else {
        route.fulfill({
          status: 401,
          body: 'Unauthorized',
        });
      }
    });

    await page.goto('https://httpbin.org/basic-auth/user/pass');
  });
});
