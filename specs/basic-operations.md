# Basic Operations Test Plan

> **Seed:** `tests/seed.spec.ts`
> **Generated:** December 1, 2025
> **Status:** Ready for test generation

## Overview

This test plan covers the basic operations of the MCP Playwright Server, including browser management, element interactions, and assertions.

---

## 1. Browser Management

**Seed:** `tests/seed.spec.ts`

### 1.1 Launch Browser Session

**Steps:**

1. Launch a new browser session (chromium)
2. Verify session is created with valid sessionId and pageId

**Expected Results:**

- Browser launches successfully
- Returns valid sessionId (UUID format)
- Returns valid pageId (UUID format)
- Browser type is correctly identified

### 1.2 Navigate to URL

**Steps:**

1. Launch browser session
2. Navigate to the base URL
3. Verify page loads successfully

**Expected Results:**

- Page navigates to target URL
- URL matches expected pattern
- Page content is accessible

### 1.3 Close Browser Session

**Steps:**

1. Launch browser session
2. Close the browser session
3. Verify session is properly terminated

**Expected Results:**

- Session closes without errors
- Resources are properly cleaned up

---

## 2. Element Interactions

**Seed:** `tests/seed.spec.ts`

### 2.1 Click Element by Role

**Steps:**

1. Navigate to test page
2. Locate button by role and name
3. Click the button
4. Verify click action completed

**Expected Results:**

- Element is found using role locator
- Click action triggers expected behavior
- Page state updates accordingly

### 2.2 Fill Input by Label

**Steps:**

1. Navigate to form page
2. Locate input by its label
3. Fill input with test value
4. Verify value is entered correctly

**Expected Results:**

- Input is found using label locator
- Value is entered into the input field
- Input value matches expected text

### 2.3 Fill Input by Placeholder

**Steps:**

1. Navigate to form page
2. Locate input by placeholder text
3. Fill input with test value
4. Verify value is entered correctly

**Expected Results:**

- Input is found using placeholder locator
- Value is entered into the input field
- Input value matches expected text

---

## 3. Assertions

**Seed:** `tests/seed.spec.ts`

### 3.1 Assert Element Visible

**Steps:**

1. Navigate to test page
2. Assert specific element is visible

**Expected Results:**

- Assertion passes when element is visible
- Assertion provides clear error when element is not found

### 3.2 Assert Text Content

**Steps:**

1. Navigate to test page
2. Assert element contains expected text

**Expected Results:**

- Assertion passes when text matches
- Partial text matching works correctly
- Case sensitivity is handled appropriately

### 3.3 Assert Page Title

**Steps:**

1. Navigate to test page
2. Assert page has expected title

**Expected Results:**

- Title assertion supports exact match
- Title assertion supports regex patterns

### 3.4 Assert URL

**Steps:**

1. Navigate to test page
2. Assert page URL matches pattern

**Expected Results:**

- URL assertion supports exact match
- URL assertion supports regex patterns
- URL assertion handles query parameters

---

## 4. Page Operations

**Seed:** `tests/seed.spec.ts`

### 4.1 Take Screenshot

**Steps:**

1. Navigate to test page
2. Capture full page screenshot
3. Verify screenshot is saved

**Expected Results:**

- Screenshot is captured successfully
- Image file is created at specified path
- Screenshot contains visible page content

### 4.2 Get Page Content

**Steps:**

1. Navigate to test page
2. Retrieve HTML/text content
3. Verify content structure

**Expected Results:**

- HTML content is returned
- Text content extraction works
- Content reflects current page state

### 4.3 Wait for Load State

**Steps:**

1. Navigate to test page
2. Wait for specific load state (domcontentloaded, load)
3. Verify page is ready

**Expected Results:**

- Wait completes when state is reached
- Different load states are properly detected

---

## 5. Error Handling

**Seed:** `tests/seed.spec.ts`

### 5.1 Handle Missing Element

**Steps:**

1. Navigate to test page
2. Attempt to interact with non-existent element
3. Verify proper error handling

**Expected Results:**

- Clear error message is returned
- Error code is appropriate (ELEMENT_NOT_FOUND)
- Error includes helpful context

### 5.2 Handle Timeout

**Steps:**

1. Navigate to slow-loading page
2. Set short timeout
3. Verify timeout handling

**Expected Results:**

- Timeout error is raised appropriately
- Error code is TIMEOUT_EXCEEDED
- Timeout value is respected

---

## Test Data Requirements

| Data      | Value                              | Purpose                      |
| --------- | ---------------------------------- | ---------------------------- |
| Base URL  | Configured in playwright.config.ts | Starting point for all tests |
| Test User | Environment variables              | Authenticated flows          |
| Timeout   | 5000ms                             | Default assertion timeout    |

## Notes

- All tests should be independent and not rely on shared state
- Use semantic locators (role, label, placeholder) over CSS selectors
- Include appropriate waits and assertions after each action
- Clean up resources (close sessions) after test completion
