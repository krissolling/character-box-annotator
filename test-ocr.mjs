// Test script for OCR implementation
import { createWorker } from 'tesseract.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIN_CONFIDENCE = 60;
const PADDING = 5;

async function testOCR() {
  console.log('🧪 Testing OCR implementation...\n');

  // Load test image
  const imagePath = path.join(__dirname, 'test-ocr-image.png');
  console.log(`📷 Loading image: ${imagePath}`);

  const image = await loadImage(imagePath);
  console.log(`   Image size: ${image.width}x${image.height}`);

  // Define test parameters
  const text = 'Hello';
  const uniqueChars = [...new Set(text.split(''))]; // ['H', 'e', 'l', 'o']
  console.log(`🎯 Target text: "${text}"`);
  console.log(`🔤 Unique chars: ${uniqueChars.join(', ')}\n`);

  // Create a region covering the whole image
  const regions = [{
    x: 0,
    y: 0,
    width: image.width,
    height: image.height
  }];

  // Create Tesseract worker
  console.log('📦 Creating Tesseract worker...');
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\r   Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  console.log('\n');

  // Set parameters to get symbol-level output
  await worker.setParameters({
    tessedit_pageseg_mode: '6', // Assume a single uniform block of text
  });

  // Process the region
  const region = regions[0];

  // Create canvas and draw image
  const canvas = createCanvas(region.width, region.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = canvas.toDataURL('image/png');

  // Run OCR
  console.log('🔍 Running OCR...');
  const result = await worker.recognize(imageData);

  // Debug: show result structure
  console.log('📋 Result text:', result.data.text);
  console.log('📋 Result confidence:', result.data.confidence);
  console.log('📋 Full result.data keys:', Object.keys(result.data));

  // Check all possible locations for symbols in tesseract.js v5
  console.log('📋 Checking result structure...');
  console.log('   result.data.symbols:', result.data.symbols?.length || 0);
  console.log('   result.data.words:', result.data.words?.length || 0);
  console.log('   result.data.lines:', result.data.lines?.length || 0);
  console.log('   result.data.paragraphs:', result.data.paragraphs?.length || 0);
  console.log('   result.data.blocks type:', Array.isArray(result.data.blocks) ? 'array' : typeof result.data.blocks);
  console.log('   result.data.layoutBlocks:', result.data.layoutBlocks?.length || 0);

  // Since blocks is an object, let's see what's in it
  if (result.data.blocks && typeof result.data.blocks === 'object') {
    console.log('   blocks keys:', Object.keys(result.data.blocks));
  }

  // Check the 'box' format output - it contains character positions
  if (result.data.box) {
    console.log('\n📋 Box format output (first 500 chars):');
    console.log(result.data.box.substring(0, 500));
  }

  // Check TSV output
  if (result.data.tsv) {
    console.log('\n📋 TSV output (first 500 chars):');
    console.log(result.data.tsv.substring(0, 500));
  }

  // Extract symbols - check nested structure (blocks -> paragraphs -> lines -> words -> symbols)
  let symbols = result.data.symbols || [];

  // If top-level symbols is empty, try to extract from nested structure
  if (symbols.length === 0 && result.data.blocks) {
    console.log('\n📋 Exploring blocks structure:');
    result.data.blocks.forEach((block, bi) => {
      console.log(`   Block ${bi}: ${block.paragraphs?.length || 0} paragraphs`);
      if (block.paragraphs) {
        block.paragraphs.forEach((para, pi) => {
          if (para.lines) {
            para.lines.forEach((line, li) => {
              if (line.words) {
                line.words.forEach((word, wi) => {
                  console.log(`      Word: "${word.text}" - ${word.symbols?.length || 0} symbols`);
                  if (word.symbols) {
                    symbols = symbols.concat(word.symbols);
                    word.symbols.forEach(s => {
                      console.log(`         Symbol: '${s.text}' conf: ${s.confidence?.toFixed(1)}% bbox: (${s.bbox?.x0}, ${s.bbox?.y0})`);
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  console.log(`\n✅ Total symbols extracted: ${symbols.length}\n`);

  // Show all detected symbols
  console.log('📝 All detected symbols:');
  symbols.forEach((s, i) => {
    console.log(`   ${i + 1}. '${s.text}' - confidence: ${s.confidence.toFixed(1)}% - bbox: (${s.bbox.x0}, ${s.bbox.y0}) to (${s.bbox.x1}, ${s.bbox.y1})`);
  });
  console.log('');

  // Filter valid symbols
  const validSymbols = symbols.filter((s) =>
    s.text &&
    s.text.trim().length > 0 &&
    s.confidence >= MIN_CONFIDENCE &&
    s.bbox &&
    s.bbox.x1 > s.bbox.x0 &&
    s.bbox.y1 > s.bbox.y0
  );

  console.log(`📊 Valid symbols (confidence ≥ ${MIN_CONFIDENCE}%): ${validSymbols.length}\n`);

  // Match to target characters
  console.log('🎯 Matching to target characters:');
  const matches = {};

  for (const targetChar of uniqueChars) {
    const candidates = validSymbols.filter((s) =>
      s.text.toLowerCase() === targetChar.toLowerCase()
    );

    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) =>
        a.confidence > b.confidence ? a : b
      );
      matches[targetChar] = best;
      console.log(`   ✓ '${targetChar}' matched with confidence ${best.confidence.toFixed(1)}%`);
    } else {
      console.log(`   ✗ '${targetChar}' not found`);
    }
  }

  // Create boxes
  console.log('\n📦 Generated boxes:');
  const addedBoxes = [];

  for (const [char, symbol] of Object.entries(matches)) {
    const box = {
      x: Math.max(0, region.x + symbol.bbox.x0 - PADDING),
      y: Math.max(0, region.y + symbol.bbox.y0 - PADDING),
      width: (symbol.bbox.x1 - symbol.bbox.x0) + (PADDING * 2),
      height: (symbol.bbox.y1 - symbol.bbox.y0) + (PADDING * 2),
      char: char,
      charIndex: uniqueChars.indexOf(char),
    };
    addedBoxes.push(box);
    console.log(`   '${char}' -> (${box.x}, ${box.y}) ${box.width}x${box.height}`);
  }

  // Terminate worker
  await worker.terminate();
  console.log('\n🧹 Worker terminated');

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Target characters: ${uniqueChars.length}`);
  console.log(`   Boxes created: ${addedBoxes.length}`);
  console.log(`   Success rate: ${Math.round((addedBoxes.length / uniqueChars.length) * 100)}%`);

  if (addedBoxes.length === uniqueChars.length) {
    console.log('\n✅ TEST PASSED - All characters detected!\n');
  } else {
    const missing = uniqueChars.filter(c => !matches[c]);
    console.log(`\n❌ TEST FAILED - Missing characters: ${missing.join(', ')}\n`);
  }
}

testOCR().catch(console.error);
