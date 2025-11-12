/**
 * Playwright test to compare React annotator with original vanilla JS version
 */

import { test, expect } from '@playwright/test';

const REACT_URL = 'http://localhost:5173/';
const ORIGINAL_URL = 'http://localhost:5000/templates/annotator.html';

test.describe('Annotator Comparison Tests', () => {
  test('Both versions should load successfully', async ({ browser }) => {
    // Open both versions in separate pages
    const context = await browser.newContext();
    const reactPage = await context.newPage();
    const originalPage = await context.newPage();

    console.log('📱 Opening React version...');
    await reactPage.goto(REACT_URL);
    await reactPage.waitForLoadState('networkidle');

    console.log('📱 Opening Original version...');
    await originalPage.goto(ORIGINAL_URL);
    await originalPage.waitForLoadState('networkidle');

    // Take screenshots
    await reactPage.screenshot({ path: 'tests/screenshots/react-initial.png', fullPage: true });
    await originalPage.screenshot({ path: 'tests/screenshots/original-initial.png', fullPage: true });

    console.log('✅ Both versions loaded successfully');

    // Check titles
    const reactTitle = await reactPage.title();
    const originalTitle = await originalPage.title();

    console.log(`React Title: "${reactTitle}"`);
    console.log(`Original Title: "${originalTitle}"`);

    // Both should have "Character Box Annotator" in the title
    expect(reactTitle).toContain('Character Box Annotator');
    expect(originalTitle).toContain('Character Box Annotator');

    await context.close();
  });

  test('React version should have setup panel with upload zone', async ({ page }) => {
    await page.goto(REACT_URL);
    await page.waitForLoadState('networkidle');

    // Check for upload zone
    const uploadZone = page.locator('text=Drop image here or click to browse');
    await expect(uploadZone).toBeVisible();

    console.log('✅ React: Upload zone visible');

    await page.screenshot({ path: 'tests/screenshots/react-setup.png', fullPage: true });
  });

  test('Original version should have setup panel with upload zone', async ({ page }) => {
    await page.goto(ORIGINAL_URL);
    await page.waitForLoadState('networkidle');

    // Check for upload zone
    const uploadZone = page.locator('text=Drop image here or click to browse');
    await expect(uploadZone).toBeVisible();

    console.log('✅ Original: Upload zone visible');

    await page.screenshot({ path: 'tests/screenshots/original-setup.png', fullPage: true });
  });

  test('React version should accept text input', async ({ page }) => {
    await page.goto(REACT_URL);
    await page.waitForLoadState('networkidle');

    // Look for text input
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible();

    // Type text
    await textInput.fill('Hello World');

    // Check if text was entered
    const value = await textInput.inputValue();
    expect(value).toBe('Hello World');

    console.log('✅ React: Text input working');

    await page.screenshot({ path: 'tests/screenshots/react-with-text.png', fullPage: true });
  });

  test('Side-by-side visual comparison', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const reactPage = await context.newPage();
    const originalPage = await context.newPage();

    // Load both versions
    await reactPage.goto(REACT_URL);
    await originalPage.goto(ORIGINAL_URL);

    await reactPage.waitForLoadState('networkidle');
    await originalPage.waitForLoadState('networkidle');

    // Take comparison screenshots
    await reactPage.screenshot({
      path: 'tests/screenshots/react-fullpage.png',
      fullPage: true
    });

    await originalPage.screenshot({
      path: 'tests/screenshots/original-fullpage.png',
      fullPage: true
    });

    console.log('✅ Screenshots saved for visual comparison');
    console.log('   - React: tests/screenshots/react-fullpage.png');
    console.log('   - Original: tests/screenshots/original-fullpage.png');

    await context.close();
  });

  test('Check for key UI elements in React version', async ({ page }) => {
    await page.goto(REACT_URL);
    await page.waitForLoadState('networkidle');

    // Check for key elements
    const elements = [
      { selector: 'text=Character Box Annotator', name: 'Title' },
      { selector: 'text=Drop image here or click to browse', name: 'Upload zone' },
      { selector: 'input[type="text"]', name: 'Text input' },
    ];

    console.log('\n🔍 Checking React UI elements:');
    for (const element of elements) {
      const locator = page.locator(element.selector).first();
      const isVisible = await locator.isVisible();
      console.log(`   ${isVisible ? '✅' : '❌'} ${element.name}`);
      expect(isVisible).toBeTruthy();
    }
  });

  test('Check for key UI elements in Original version', async ({ page }) => {
    await page.goto(ORIGINAL_URL);
    await page.waitForLoadState('networkidle');

    // Check for key elements
    const elements = [
      { selector: 'text=Character Box Annotator', name: 'Title' },
      { selector: 'text=Drop image here or click to browse', name: 'Upload zone' },
    ];

    console.log('\n🔍 Checking Original UI elements:');
    for (const element of elements) {
      const locator = page.locator(element.selector).first();
      const isVisible = await locator.isVisible();
      console.log(`   ${isVisible ? '✅' : '❌'} ${element.name}`);
      expect(isVisible).toBeTruthy();
    }
  });
});

test.describe('Feature Parity Check', () => {
  test('Compare available features', async ({ browser }) => {
    const context = await browser.newContext();
    const reactPage = await context.newPage();
    const originalPage = await context.newPage();

    await reactPage.goto(REACT_URL);
    await originalPage.goto(ORIGINAL_URL);

    await reactPage.waitForLoadState('networkidle');
    await originalPage.waitForLoadState('networkidle');

    console.log('\n📊 Feature Comparison:');
    console.log('='.repeat(50));

    // Check upload functionality
    const reactUpload = await reactPage.locator('text=Drop image here').isVisible();
    const originalUpload = await originalPage.locator('text=Drop image here').isVisible();
    console.log(`Upload Zone:     React ${reactUpload ? '✅' : '❌'}  |  Original ${originalUpload ? '✅' : '❌'}`);

    // Check text input (only React has visible one in setup)
    const reactTextInput = await reactPage.locator('input[type="text"]').first().isVisible();
    console.log(`Text Input:      React ${reactTextInput ? '✅' : '❌'}  |  Original ⏳ (modal-based)`);

    await context.close();
  });
});
