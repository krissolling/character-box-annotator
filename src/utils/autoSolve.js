// Use Tesseract from CDN (loaded in index.html) for proper symbol-level data
// The npm package doesn't return symbols, but the CDN version does
const Tesseract = window.Tesseract;

const MIN_CONFIDENCE = 60; // Minimum OCR confidence threshold
const PADDING = 2; // Padding around detected characters

// Characters with descenders that extend below the baseline
const DESCENDERS = new Set(['g', 'j', 'p', 'q', 'y', 'Q']);

/**
 * Convert selected line groups into annotation boxes
 * @param {Array} selectedLineGroups - Line groups selected by user
 * @param {Array} uniqueChars - Unique characters from target string
 * @param {Array} existingBoxes - Existing boxes to avoid duplicates
 * @param {HTMLImageElement} image - The source image
 * @returns {{boxes: Array, baselines: Array}}
 */
export function processSelectedLineGroups(selectedLineGroups, uniqueChars, existingBoxes, image) {
  const boxes = [];
  const baselines = [];
  const charToBox = {};

  // Build existing char map
  existingBoxes.forEach(box => {
    charToBox[box.char] = box;
  });

  // Process each selected line
  selectedLineGroups.forEach(line => {
    // Add baseline if available (with deduplication)
    if (line.baseline) {
      // Check for duplicate baselines within 5px tolerance
      const isDuplicate = baselines.some(existing => {
        const existingAvgY = (existing.y0 + existing.y1) / 2;
        const newAvgY = (line.baseline.y0 + line.baseline.y1) / 2;
        return Math.abs(existingAvgY - newAvgY) < 5;
      });

      if (!isDuplicate) {
        baselines.push(line.baseline);
        console.log(`📏 Added baseline from line "${line.text}" at Y=${((line.baseline.y0 + line.baseline.y1) / 2).toFixed(1)}`);
      } else {
        console.log(`⏭️ Skipping duplicate baseline from line "${line.text}" at Y=${((line.baseline.y0 + line.baseline.y1) / 2).toFixed(1)}`);
      }
    }

    // Sort symbols left-to-right
    const sortedSymbols = [...line.symbols].sort((a, b) => a.bbox.x0 - b.bbox.x0);

    // Filter valid symbols
    const validSymbols = sortedSymbols.filter(s =>
      s.text &&
      s.text.trim().length > 0 &&
      s.confidence >= MIN_CONFIDENCE &&
      s.bbox &&
      s.bbox.x1 > s.bbox.x0 &&
      s.bbox.y1 > s.bbox.y0
    );

    // Match symbols to unique chars (leftmost first)
    validSymbols.forEach(symbol => {
      const char = symbol.text;

      // Skip if we already have a box for this character
      if (charToBox[char]) return;

      const isInTarget = uniqueChars.includes(char);

      const box = {
        x: Math.max(0, line.region.x + symbol.bbox.x0 - PADDING),
        y: Math.max(0, line.region.y + symbol.bbox.y0 - PADDING),
        width: (symbol.bbox.x1 - symbol.bbox.x0) + (PADDING * 2),
        height: (symbol.bbox.y1 - symbol.bbox.y0) + (PADDING * 2),
        char: char,
        charIndex: isInTarget ? uniqueChars.indexOf(char) : -1, // -1 for orphaned boxes
      };

      // Ensure box doesn't exceed image bounds
      if (image) {
        if (box.x + box.width > image.width) {
          box.width = image.width - box.x;
        }
        if (box.y + box.height > image.height) {
          box.height = image.height - box.y;
        }
      }

      boxes.push(box);
      charToBox[char] = box;

      if (isInTarget) {
        console.log(`✨ Added box for '${char}' from line "${line.text}"`);
      } else {
        console.log(`👻 Added orphaned box for '${char}' from line "${line.text}"`);
      }
    });
  });

  return { boxes, baselines };
}

/**
 * Process auto-solve regions using Tesseract.js OCR
 * @param {HTMLImageElement} image - The source image
 * @param {Array} regions - Array of regions to process
 * @param {Array} boxes - Existing boxes
 * @param {Array} uniqueChars - Unique characters from the target string
 * @param {string} text - The target text string
 * @param {number} imageRotation - Rotation angle in degrees (default 0)
 * @param {boolean} returnLineGrouped - If true, return line-grouped results for picker UI
 * @returns {Promise<{addedBoxes: Array, skippedCount: number, suggestedBaselines: Array, lineGroups?: Array}>}
 */
export async function processAutoSolveRegions(image, regions, boxes, uniqueChars, text, imageRotation = 0, returnLineGrouped = false) {
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
  const allLineBaselines = []; // Collect Tesseract baseline data from lines
  const allLineGroups = []; // Collect line-grouped data for picker UI

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

    // Extract symbols and baseline info from blocks structure (v6 requires manual extraction)
    // Structure: blocks -> paragraphs -> lines -> words -> symbols
    let symbols = [];

    if (result.data.blocks && Array.isArray(result.data.blocks)) {
      result.data.blocks.forEach(block => {
        if (block.paragraphs) {
          block.paragraphs.forEach(paragraph => {
            if (paragraph.lines) {
              paragraph.lines.forEach(line => {
                // Collect line symbols
                const lineSymbols = [];
                let lineText = '';

                if (line.words) {
                  line.words.forEach(word => {
                    if (word.symbols) {
                      lineSymbols.push(...word.symbols);
                    }
                    lineText += (word.text || '') + ' ';
                  });
                }
                lineText = lineText.trim();

                // Extract baseline from line if available
                if (line.baseline) {
                  allLineBaselines.push({
                    // Convert from region-relative to absolute image coordinates
                    x0: region.x + line.baseline.x0,
                    y0: region.y + line.baseline.y0,
                    x1: region.x + line.baseline.x1,
                    y1: region.y + line.baseline.y1,
                    confidence: line.confidence || 0
                  });
                  console.log(`📏 Found Tesseract baseline: (${line.baseline.x0}, ${line.baseline.y0}) to (${line.baseline.x1}, ${line.baseline.y1})`);
                }

                // Collect line group data for picker UI
                if (returnLineGrouped && lineSymbols.length > 0 && line.bbox) {
                  const lineHeight = line.bbox.y1 - line.bbox.y0;
                  allLineGroups.push({
                    id: allLineGroups.length,
                    text: lineText,
                    symbols: lineSymbols,
                    bbox: {
                      x: region.x + line.bbox.x0,
                      y: region.y + line.bbox.y0,
                      width: line.bbox.x1 - line.bbox.x0,
                      height: lineHeight
                    },
                    baseline: line.baseline ? {
                      x0: region.x + line.baseline.x0,
                      y0: region.y + line.baseline.y0,
                      x1: region.x + line.baseline.x1,
                      y1: region.y + line.baseline.y1,
                    } : null,
                    fontSize: Math.round(lineHeight * 0.75), // Approximate font size
                    confidence: line.confidence || 0,
                    region: region
                  });
                  console.log(`📝 Line group: "${lineText}" (~${Math.round(lineHeight * 0.75)}px)`);
                }

                // Add symbols to main list
                symbols = symbols.concat(lineSymbols);
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

  // Calculate suggested baselines using hybrid approach
  const suggestedBaselines = calculateSuggestedBaselines(allLineBaselines, addedBoxes, allMatches);

  // Return with line groups if requested
  if (returnLineGrouped) {
    return { addedBoxes, skippedCount, suggestedBaselines, lineGroups: allLineGroups };
  }

  return { addedBoxes, skippedCount, suggestedBaselines };
}

/**
 * Calculate suggested baselines using hybrid approach:
 * 1. Use Tesseract line baselines if available
 * 2. Fall back to calculating from symbol positions (excluding descenders)
 * @param {Array} lineBaselines - Baseline data from Tesseract lines
 * @param {Array} addedBoxes - Boxes that were added
 * @param {Object} allMatches - All matched symbols with their data
 * @returns {Array} Array of suggested baseline objects
 */
function calculateSuggestedBaselines(lineBaselines, addedBoxes, allMatches) {
  const suggestedBaselines = [];

  // Option 1: Use Tesseract baselines if available
  if (lineBaselines.length > 0) {
    console.log(`📏 Using ${lineBaselines.length} Tesseract baseline(s)`);

    lineBaselines.forEach((baseline, index) => {
      // Calculate angle from the baseline endpoints
      const dx = baseline.x1 - baseline.x0;
      const dy = baseline.y1 - baseline.y0;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // For horizontal baselines (angle close to 0), use simple Y coordinate
      if (Math.abs(angle) < 2) {
        // Average the Y values for a horizontal baseline
        const y = (baseline.y0 + baseline.y1) / 2;
        suggestedBaselines.push({
          type: 'horizontal',
          y: y,
          source: 'tesseract',
          confidence: baseline.confidence
        });
        console.log(`  ➡️ Horizontal baseline at Y=${y.toFixed(1)} (confidence: ${baseline.confidence.toFixed(1)}%)`);
      } else {
        // For angled baselines, store the full line data
        suggestedBaselines.push({
          type: 'angled',
          x0: baseline.x0,
          y0: baseline.y0,
          x1: baseline.x1,
          y1: baseline.y1,
          angle: angle,
          source: 'tesseract',
          confidence: baseline.confidence
        });
        console.log(`  ↗️ Angled baseline at ${angle.toFixed(1)}° (confidence: ${baseline.confidence.toFixed(1)}%)`);
      }
    });

    return suggestedBaselines;
  }

  // Option 2: Fall back to calculating from symbol positions
  console.log('📏 No Tesseract baselines found, calculating from symbol positions...');

  if (addedBoxes.length === 0) {
    console.log('  ⚠️ No boxes to calculate baseline from');
    return suggestedBaselines;
  }

  // Get bottom Y coordinates of non-descender characters
  const baselinePoints = [];

  for (const box of addedBoxes) {
    const char = box.char;

    // Skip descenders - they extend below the baseline
    if (DESCENDERS.has(char)) {
      console.log(`  ⏭️ Skipping descender '${char}' for baseline calculation`);
      continue;
    }

    // Use the bottom of the box (y + height) as a baseline estimate
    const bottomY = box.y + box.height - PADDING; // Remove padding we added
    baselinePoints.push({
      x: box.x + box.width / 2, // Center X of box
      y: bottomY,
      char: char
    });
  }

  if (baselinePoints.length === 0) {
    console.log('  ⚠️ No non-descender characters found for baseline calculation');
    return suggestedBaselines;
  }

  // Sort points by X position for potential angle detection
  baselinePoints.sort((a, b) => a.x - b.x);

  // Calculate average Y (simple horizontal baseline)
  const avgY = baselinePoints.reduce((sum, p) => sum + p.y, 0) / baselinePoints.length;

  // Check if there's a consistent angle using linear regression
  if (baselinePoints.length >= 2) {
    const { slope, intercept, r2 } = linearRegression(baselinePoints);
    const angle = Math.atan(slope) * (180 / Math.PI);

    console.log(`  📊 Linear regression: slope=${slope.toFixed(4)}, angle=${angle.toFixed(2)}°, R²=${r2.toFixed(3)}`);

    // If R² is high and angle is significant, suggest angled baseline
    if (r2 > 0.8 && Math.abs(angle) > 1) {
      const minX = baselinePoints[0].x;
      const maxX = baselinePoints[baselinePoints.length - 1].x;

      suggestedBaselines.push({
        type: 'angled',
        x0: minX,
        y0: slope * minX + intercept,
        x1: maxX,
        y1: slope * maxX + intercept,
        angle: angle,
        source: 'calculated',
        confidence: r2 * 100
      });
      console.log(`  ↗️ Calculated angled baseline at ${angle.toFixed(1)}°`);
    } else {
      // Use horizontal baseline at average Y
      suggestedBaselines.push({
        type: 'horizontal',
        y: avgY,
        source: 'calculated',
        confidence: r2 * 100
      });
      console.log(`  ➡️ Calculated horizontal baseline at Y=${avgY.toFixed(1)}`);
    }
  } else {
    // Only one point, use horizontal baseline
    suggestedBaselines.push({
      type: 'horizontal',
      y: avgY,
      source: 'calculated',
      confidence: 50
    });
    console.log(`  ➡️ Single-point horizontal baseline at Y=${avgY.toFixed(1)}`);
  }

  return suggestedBaselines;
}

/**
 * Simple linear regression to find baseline angle
 * @param {Array} points - Array of {x, y} points
 * @returns {{slope: number, intercept: number, r2: number}}
 */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R² (coefficient of determination)
  const meanY = sumY / n;
  let ssTotal = 0, ssResidual = 0;

  for (const p of points) {
    ssTotal += (p.y - meanY) ** 2;
    ssResidual += (p.y - (slope * p.x + intercept)) ** 2;
  }

  const r2 = ssTotal === 0 ? 1 : 1 - (ssResidual / ssTotal);

  return { slope, intercept, r2: Math.max(0, r2) };
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
      // Take the first (leftmost) match - candidates are already sorted by x position
      const best = candidates[0];

      matches[targetChar] = best;
      matchedSymbols.add(best);
      console.log(`✓ '${targetChar}' matched (leftmost) with confidence ${best.confidence.toFixed(1)}%`);
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
