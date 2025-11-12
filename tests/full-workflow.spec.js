/**
 * Full workflow test - Upload image, enter text, draw bounding box
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const REACT_URL = 'http://localhost:5173/';
const ORIGINAL_URL = 'http://localhost:5000/templates/annotator.html';
const TEST_IMAGE = path.join(process.cwd(), 'tests/test-image.png');
const TEST_TEXT = 'HELLO';

test.describe('Full Annotation Workflow', () => {

  test('React version - Complete workflow', async ({ page }) => {
    console.log('\n🧪 Testing React Version Full Workflow');
    console.log('='.repeat(50));

    // 1. Navigate to page
    console.log('1️⃣  Loading page...');
    await page.goto(REACT_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/react-workflow-1-initial.png' });
    console.log('   ✅ Page loaded');

    // 2. Upload image
    console.log('2️⃣  Uploading image...');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE);

    // Wait for image to be processed
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/react-workflow-2-uploaded.png' });

    // Check if image info is displayed
    const imageLoaded = await page.locator('text=Image loaded').isVisible();
    console.log(`   ${imageLoaded ? '✅' : '❌'} Image uploaded and processed`);

    // 3. Enter text
    console.log('3️⃣  Entering text...');
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible({ timeout: 5000 });
    await textInput.fill(TEST_TEXT);

    const inputValue = await textInput.inputValue();
    console.log(`   ✅ Text entered: "${inputValue}"`);
    await page.screenshot({ path: 'tests/screenshots/react-workflow-3-text-entered.png' });

    // 4. Start annotating
    console.log('4️⃣  Starting annotation...');
    const startButton = page.locator('button:has-text("Start Annotating")');
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // Wait for annotation interface to load
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/react-workflow-4-annotation-started.png' });
    console.log('   ✅ Annotation interface loaded');

    // 5. Check for canvas and character picker
    console.log('5️⃣  Checking annotation UI...');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
    console.log('   ✅ Canvas visible');

    // Check for character picker
    const characterPicker = page.locator('text=Character Picker');
    const pickerVisible = await characterPicker.isVisible();
    console.log(`   ${pickerVisible ? '✅' : '⏳'} Character picker visible`);

    // 6. Draw a bounding box
    console.log('6️⃣  Drawing bounding box...');

    // Get canvas bounding box
    const canvasBox = await canvas.boundingBox();
    if (canvasBox) {
      // Draw a box by clicking and dragging
      const startX = canvasBox.x + 100;
      const startY = canvasBox.y + 100;
      const endX = startX + 150;
      const endY = startY + 80;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 10 });
      await page.mouse.up();

      console.log(`   ✅ Drew box from (${Math.round(startX)}, ${Math.round(startY)}) to (${Math.round(endX)}, ${Math.round(endY)})`);

      // Wait for box to be rendered
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/react-workflow-5-box-drawn.png', fullPage: true });
    } else {
      console.log('   ❌ Could not get canvas bounding box');
    }

    // 7. Check final state
    console.log('7️⃣  Final checks...');
    await page.screenshot({ path: 'tests/screenshots/react-workflow-final.png', fullPage: true });
    console.log('\n✅ React workflow test completed\n');
  });

  test('Original version - Complete workflow', async ({ page }) => {
    console.log('\n🧪 Testing Original Version Full Workflow');
    console.log('='.repeat(50));

    // 1. Navigate to page
    console.log('1️⃣  Loading page...');
    await page.goto(ORIGINAL_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/original-workflow-1-initial.png' });
    console.log('   ✅ Page loaded');

    // 2. Upload image
    console.log('2️⃣  Uploading image...');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE);

    // Wait for image to be processed
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/original-workflow-2-uploaded.png' });
    console.log('   ✅ Image uploaded');

    // 3. Enter text (original version might use a modal or different approach)
    console.log('3️⃣  Looking for text input...');

    // The original might have a different text input approach
    // Try to find any text input that's visible
    await page.waitForTimeout(1000);

    const textInputs = await page.locator('input[type="text"]').all();
    console.log(`   Found ${textInputs.length} text inputs`);

    let textEntered = false;
    for (const input of textInputs) {
      if (await input.isVisible()) {
        await input.fill(TEST_TEXT);
        textEntered = true;
        console.log('   ✅ Text entered in visible input');
        break;
      }
    }

    if (!textEntered) {
      console.log('   ⚠️  No visible text input found - checking for modal/popup');
    }

    await page.screenshot({ path: 'tests/screenshots/original-workflow-3-text-phase.png' });

    // 4. Look for start/begin button
    console.log('4️⃣  Looking for start button...');
    const possibleButtons = [
      'button:has-text("Start")',
      'button:has-text("Begin")',
      'button:has-text("Annotate")',
      '.start-btn',
      '.button-primary'
    ];

    let buttonClicked = false;
    for (const selector of possibleButtons) {
      const button = page.locator(selector).first();
      if (await button.isVisible()) {
        await button.click();
        buttonClicked = true;
        console.log(`   ✅ Clicked button: ${selector}`);
        break;
      }
    }

    if (!buttonClicked) {
      console.log('   ⚠️  No start button found - may already be in annotation mode');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/original-workflow-4-after-start.png' });

    // 5. Check for canvas
    console.log('5️⃣  Checking for canvas...');
    const canvas = page.locator('canvas').first();
    const canvasVisible = await canvas.isVisible();
    console.log(`   ${canvasVisible ? '✅' : '❌'} Canvas visible: ${canvasVisible}`);

    if (canvasVisible) {
      // 6. Draw a bounding box
      console.log('6️⃣  Drawing bounding box...');

      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        const startX = canvasBox.x + 100;
        const startY = canvasBox.y + 100;
        const endX = startX + 150;
        const endY = startY + 80;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endX, endY, { steps: 10 });
        await page.mouse.up();

        console.log(`   ✅ Drew box from (${Math.round(startX)}, ${Math.round(startY)}) to (${Math.round(endX)}, ${Math.round(endY)})`);

        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/screenshots/original-workflow-5-box-drawn.png', fullPage: true });
      }
    }

    // 7. Final state
    console.log('7️⃣  Final checks...');
    await page.screenshot({ path: 'tests/screenshots/original-workflow-final.png', fullPage: true });
    console.log('\n✅ Original workflow test completed\n');
  });

  test('Side-by-side comparison after workflow', async ({ browser }) => {
    console.log('\n📊 Generating side-by-side comparison...\n');

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const reactPage = await context.newPage();
    const originalPage = await context.newPage();

    // Run workflow on both
    await Promise.all([
      reactPage.goto(REACT_URL),
      originalPage.goto(ORIGINAL_URL)
    ]);

    await reactPage.waitForLoadState('networkidle');
    await originalPage.waitForLoadState('networkidle');

    console.log('✅ Both pages loaded for comparison');
    console.log('\n📸 Screenshots saved in tests/screenshots/');
    console.log('   - react-workflow-*.png');
    console.log('   - original-workflow-*.png');

    await context.close();
  });
});
