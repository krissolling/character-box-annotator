// Use Tesseract from CDN (loaded in index.html) for proper symbol-level data
// The npm package doesn't return symbols, but the CDN version does
const Tesseract = window.Tesseract;

const MIN_CONFIDENCE = 60; // Minimum OCR confidence threshold
const PADDING = 5; // Padding around detected characters

/**
 * Process auto-solve regions using Tesseract.js OCR
 * @param {HTMLImageElement} image - The source image
 * @param {Array} regions - Array of regions to process
 * @param {Array} boxes - Existing boxes
 * @param {Array} uniqueChars - Unique characters from the target string
 * @param {string} text - The target text string
 * @param {number} imageRotation - Rotation angle in degrees (default 0)
 * @returns {Promise<{addedBoxes: Array, skippedCount: number}>}
 */
export async function processAutoSolveRegions(image, regions, boxes, uniqueChars, text, imageRotation = 0) {
  if (regions.length === 0) {
    throw new Error('No regions to process');
  }

  console.log(`📦 Processing ${regions.length} region(s)`);

  // Create Tesseract worker (using CDN global)
  console.log('📦 Creating Tesseract worker...');
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m) => console.log('Tesseract:', m),
  });

  // Create a character-to-box map for quick lookups
  const charToBox = {};
  boxes.forEach((box) => {
    charToBox[box.char] = box;
  });

  // Create full canvas with rotation applied (like working implementation)
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = image.width;
  fullCanvas.height = image.height;
  const fullCtx = fullCanvas.getContext('2d');

  // Apply rotation if there is any
  if (imageRotation !== 0) {
    fullCtx.save();
    fullCtx.translate(fullCanvas.width / 2, fullCanvas.height / 2);
    fullCtx.rotate(imageRotation * Math.PI / 180);
    fullCtx.translate(-fullCanvas.width / 2, -fullCanvas.height / 2);
    fullCtx.drawImage(image, 0, 0, fullCanvas.width, fullCanvas.height);
    fullCtx.restore();
    console.log(`🔄 Applied ${imageRotation}° rotation to image for OCR`);
  } else {
    fullCtx.drawImage(image, 0, 0);
  }

  // Process all regions
  const allMatches = {};

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
    const region = regions[regionIndex];
    console.log(`\n📦 Processing region ${regionIndex + 1}/${regions.length}`);

    // Crop to selected region from the rotated full canvas
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = region.width;
    cropCanvas.height = region.height;
    const cropCtx = cropCanvas.getContext('2d');

    // Copy the selected region from full canvas (which has rotation applied)
    cropCtx.drawImage(
      fullCanvas,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );

    console.log(`✂️ Cropped to region: ${region.width}x${region.height} at (${region.x}, ${region.y})`);

    const imageData = cropCanvas.toDataURL('image/png');

    // Run OCR (v6 requires explicit blocks output to get symbols)
    console.log('🔍 Running OCR on region...');
    const result = await worker.recognize(imageData, {}, { blocks: true });

    // Debug: Check what Tesseract actually recognized
    console.log('📋 OCR Result text:', result.data.text);
    console.log('📋 OCR Result confidence:', result.data.confidence);
    console.log('📋 OCR Result keys:', Object.keys(result.data));

    // Extract symbols from blocks structure (v6 requires manual extraction)
    // Structure: blocks -> paragraphs -> lines -> words -> symbols
    let symbols = [];

    if (result.data.blocks && Array.isArray(result.data.blocks)) {
      result.data.blocks.forEach(block => {
        if (block.paragraphs) {
          block.paragraphs.forEach(paragraph => {
            if (paragraph.lines) {
              paragraph.lines.forEach(line => {
                if (line.words) {
                  line.words.forEach(word => {
                    if (word.symbols) {
                      symbols = symbols.concat(word.symbols);
                    }
                  });
                }
              });
            }
          });
        }
      });
    }

    console.log(`✅ Found ${symbols.length} symbols in region`);

    // Debug: show symbol details including confidence
    if (symbols.length > 0) {
      console.log('📝 Symbol details:');
      symbols.forEach((s, i) => {
        console.log(`   ${i + 1}. '${s.text}' - confidence: ${s.confidence} - bbox: (${s.bbox.x0}, ${s.bbox.y0}) to (${s.bbox.x1}, ${s.bbox.y1})`);
      });
    }

    // Match symbols to our string
    const matches = matchSymbolsToString(symbols, uniqueChars, text);
    console.log('🎯 Matched symbols:', matches);

    // Add matches to combined results, with region offset
    for (const [char, symbol] of Object.entries(matches)) {
      // Only keep highest confidence match for each character across all regions
      if (!allMatches[char] || symbol.confidence > allMatches[char].symbol.confidence) {
        allMatches[char] = {
          symbol: symbol,
          region: region,
        };
      }
    }
  }

  // Terminate worker
  await worker.terminate();
  console.log('🧹 Tesseract worker terminated');

  // Create bounding boxes from best matches
  const addedBoxes = [];
  let skippedCount = 0;
  let orphanedCount = 0;

  for (const [char, match] of Object.entries(allMatches)) {
    const isInTargetString = uniqueChars.includes(char);

    // Skip if this character already has a box (only for target characters)
    if (isInTargetString && charToBox[char]) {
      console.log(`⏭️ Skipping '${char}' - already has a box`);
      skippedCount++;
      continue;
    }

    // Create box from Tesseract bbox with padding
    const box = {
      x: Math.max(0, match.region.x + match.symbol.bbox.x0 - PADDING),
      y: Math.max(0, match.region.y + match.symbol.bbox.y0 - PADDING),
      width: (match.symbol.bbox.x1 - match.symbol.bbox.x0) + (PADDING * 2),
      height: (match.symbol.bbox.y1 - match.symbol.bbox.y0) + (PADDING * 2),
      char: char,
      charIndex: uniqueChars.indexOf(char), // -1 for orphaned boxes
    };

    // Ensure box doesn't exceed image bounds
    if (box.x + box.width > image.width) {
      box.width = image.width - box.x;
    }
    if (box.y + box.height > image.height) {
      box.height = image.height - box.y;
    }

    addedBoxes.push(box);

    if (isInTargetString) {
      console.log(`✨ Added box for '${char}' at (${box.x}, ${box.y}) ${box.width}x${box.height} - Confidence: ${match.symbol.confidence.toFixed(1)}%`);
    } else {
      orphanedCount++;
      console.log(`👻 Added orphaned box for '${char}' at (${box.x}, ${box.y}) ${box.width}x${box.height} - Confidence: ${match.symbol.confidence.toFixed(1)}%`);
    }
  }

  return { addedBoxes, skippedCount };
}

/**
 * Match Tesseract symbols to target string
 * @param {Array} tesseractSymbols - Symbols from Tesseract OCR
 * @param {Array} uniqueChars - Unique characters from target string
 * @param {string} targetString - The target text string
 * @returns {Object} Map of characters to their best matching symbols
 */
function matchSymbolsToString(tesseractSymbols, uniqueChars, targetString) {
  console.log('🔍 Matching symbols to target string:', targetString);

  // Filter out low-confidence and empty symbols
  const validSymbols = tesseractSymbols.filter((s) =>
    s.text &&
    s.text.trim().length > 0 &&
    s.confidence >= MIN_CONFIDENCE &&
    s.bbox &&
    s.bbox.x1 > s.bbox.x0 &&
    s.bbox.y1 > s.bbox.y0
  );

  console.log(`📊 Filtered to ${validSymbols.length} valid symbols (confidence ≥ ${MIN_CONFIDENCE}%)`);

  // Log all detected symbols for debugging
  if (validSymbols.length > 0) {
    console.log('📝 Detected symbols:', validSymbols.map(s => `'${s.text}' (${s.confidence.toFixed(1)}%)`).join(', '));
  } else {
    console.log('⚠️ No valid symbols found. Raw symbols:', tesseractSymbols.map(s => `'${s.text}' (${s.confidence?.toFixed(1) || 0}%)`).join(', '));
  }

  console.log('🎯 Looking for characters:', uniqueChars.join(', '));

  // Sort symbols left-to-right by x position
  const sorted = validSymbols.sort((a, b) => a.bbox.x0 - b.bbox.x0);

  // Build a map of characters to their best matching symbols
  const matches = {};
  const matchedSymbols = new Set();

  // For each unique character in our string
  for (const targetChar of uniqueChars) {
    // Find all symbols that match this character (case-insensitive)
    const candidates = sorted.filter((s) =>
      s.text.toLowerCase() === targetChar.toLowerCase()
    );

    if (candidates.length > 0) {
      // Take the highest confidence match
      const best = candidates.reduce((a, b) =>
        a.confidence > b.confidence ? a : b
      );

      matches[targetChar] = best;
      matchedSymbols.add(best);
      console.log(`✓ '${targetChar}' matched with confidence ${best.confidence.toFixed(1)}%`);
    } else {
      console.log(`✗ '${targetChar}' not found in region`);
    }
  }

  // Also add symbols that weren't matched to any target character (orphaned)
  for (const symbol of sorted) {
    if (!matchedSymbols.has(symbol)) {
      const char = symbol.text;
      // Only add if we don't already have a better match for this character
      if (!matches[char] || symbol.confidence > matches[char].confidence) {
        matches[char] = symbol;
        console.log(`👻 '${char}' detected but not in target string (confidence ${symbol.confidence.toFixed(1)}%)`);
      }
    }
  }

  return matches;
}
