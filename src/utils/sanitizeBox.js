/**
 * Sanitize Bounding Box - Auto-mask partial letters at edges
 *
 * MVP Implementation: Column density analysis
 * Detects "valleys" (low pixel density) near left/right edges
 * and masks everything from edge to valley (the intruding partial letter)
 */

/**
 * Analyze a bounding box and generate a mask for intruding partial letters
 * @param {HTMLImageElement} image - Source image
 * @param {Object} box - Box with x, y, width, height
 * @param {Object} options - Configuration options
 * @returns {Object} { leftMask, rightMask, debugData } - Mask regions and debug info
 */
export function analyzeBoxForIntruders(image, box, options = {}) {
  const {
    threshold = 128,        // Grayscale threshold for "dark" pixels
    valleyThreshold = 0.1,  // Density below this is considered a valley (10% of max)
    edgeSearchPercent = 30, // Search for valleys within this % of width from each edge
    minValleyWidth = 3,     // Minimum consecutive low-density columns to count as valley
    invert = false,         // If true, look for light pixels instead of dark
  } = options;

  // Create offscreen canvas to extract pixel data
  const canvas = document.createElement('canvas');
  canvas.width = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext('2d');

  // Draw the box region
  ctx.drawImage(
    image,
    box.x, box.y, box.width, box.height,
    0, 0, box.width, box.height
  );

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, box.width, box.height);
  const pixels = imageData.data;

  // Calculate column density (sum of dark pixels per column)
  const columnDensity = [];
  for (let x = 0; x < box.width; x++) {
    let darkCount = 0;
    for (let y = 0; y < box.height; y++) {
      const idx = (y * box.width + x) * 4;
      // Convert to grayscale using luminance formula
      const gray = pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
      const isDark = invert ? gray > threshold : gray < threshold;
      if (isDark) darkCount++;
    }
    columnDensity.push(darkCount);
  }

  // Find max density for relative threshold
  const maxDensity = Math.max(...columnDensity);
  const valleyThresholdAbsolute = maxDensity * valleyThreshold;
  const contentThreshold = maxDensity * 0.3; // Above this = content (letter pixels)

  // Search for pattern: CONTENT -> VALLEY from left edge
  // If we see content at the edge, then a valley, that content is an intruder
  const edgeSearchWidth = Math.floor(box.width * (edgeSearchPercent / 100));

  let leftIntruderEnd = null;
  let sawContentOnLeft = false;
  let consecutiveLow = 0;

  for (let x = 0; x < edgeSearchWidth; x++) {
    const isContent = columnDensity[x] > contentThreshold;
    const isValley = columnDensity[x] <= valleyThresholdAbsolute;

    if (isContent) {
      sawContentOnLeft = true;
      consecutiveLow = 0;
    } else if (isValley && sawContentOnLeft) {
      consecutiveLow++;
      if (consecutiveLow >= minValleyWidth) {
        // Found a valley after content - the content before was an intruder
        // Mask from 0 to the start of the valley
        leftIntruderEnd = x - consecutiveLow + 1;
        break;
      }
    } else {
      // Medium density - reset valley counter but keep looking
      consecutiveLow = 0;
    }
  }

  // Search for pattern: VALLEY -> CONTENT from right edge
  // If we see a valley, then content at the edge, that content is an intruder
  let rightIntruderStart = null;
  let sawContentOnRight = false;
  consecutiveLow = 0;

  for (let x = box.width - 1; x >= box.width - edgeSearchWidth; x--) {
    const isContent = columnDensity[x] > contentThreshold;
    const isValley = columnDensity[x] <= valleyThresholdAbsolute;

    if (isContent) {
      sawContentOnRight = true;
      consecutiveLow = 0;
    } else if (isValley && sawContentOnRight) {
      consecutiveLow++;
      if (consecutiveLow >= minValleyWidth) {
        // Found a valley after content (scanning from right) - content after valley is intruder
        // Mask from end of valley to width
        rightIntruderStart = x + consecutiveLow;
        break;
      }
    } else {
      consecutiveLow = 0;
    }
  }

  // Use the detected intruder regions
  let leftMaskEnd = leftIntruderEnd;
  let rightMaskStart = rightIntruderStart;

  return {
    leftMaskEnd,      // Mask columns 0 to leftMaskEnd (exclusive)
    rightMaskStart,   // Mask columns rightMaskStart to width
    debugData: {
      columnDensity,
      maxDensity,
      valleyThresholdAbsolute,
      contentThreshold,
      leftIntruderEnd,
      rightIntruderStart,
    }
  };
}

/**
 * Generate erase mask strokes for the intruding regions
 * @param {Object} box - Box with x, y, width, height
 * @param {Object} analysis - Result from analyzeBoxForIntruders
 * @returns {Array} Array of erase strokes in the same format as CharacterEditModal eraseMask
 */
export function generateMaskStrokes(box, analysis) {
  const strokes = [];

  // Left mask - multiple vertical strokes covering left intruder
  if (analysis.leftMaskEnd !== null && analysis.leftMaskEnd > 0) {
    const maskWidth = analysis.leftMaskEnd;
    const strokeSize = 10; // Size of each erase circle
    const step = strokeSize * 0.7; // Overlap for full coverage

    // Create vertical strokes across the width of the intruder area
    for (let x = 0; x < maskWidth; x += step) {
      const absoluteX = box.x + x;
      const points = [];

      // Generate points along the height
      for (let y = 0; y <= box.height; y += step) {
        points.push({ x: absoluteX, y: box.y + y });
      }
      // Ensure we hit the bottom
      points.push({ x: absoluteX, y: box.y + box.height });

      strokes.push({
        points,
        size: strokeSize
      });
    }
  }

  // Right mask - multiple vertical strokes covering right intruder
  if (analysis.rightMaskStart !== null && analysis.rightMaskStart < box.width) {
    const strokeSize = 10;
    const step = strokeSize * 0.7;

    for (let x = analysis.rightMaskStart; x < box.width; x += step) {
      const absoluteX = box.x + x;
      const points = [];

      for (let y = 0; y <= box.height; y += step) {
        points.push({ x: absoluteX, y: box.y + y });
      }
      points.push({ x: absoluteX, y: box.y + box.height });

      strokes.push({
        points,
        size: strokeSize
      });
    }
    // Ensure we hit the right edge
    const lastX = box.x + box.width;
    const lastPoints = [];
    for (let y = 0; y <= box.height; y += step) {
      lastPoints.push({ x: lastX, y: box.y + y });
    }
    lastPoints.push({ x: lastX, y: box.y + box.height });
    strokes.push({ points: lastPoints, size: strokeSize });
  }

  return strokes;
}

/**
 * Main function: Sanitize a box by analyzing and generating mask
 * @param {HTMLImageElement} image - Source image
 * @param {Object} box - Box with x, y, width, height, and optionally existing brushMask
 * @param {Object} options - Configuration options
 * @returns {Object} { brushMask, analysis } - New brush mask and debug data
 */
export function sanitizeBox(image, box, options = {}) {
  const analysis = analyzeBoxForIntruders(image, box, options);
  const newStrokes = generateMaskStrokes(box, analysis);

  // Merge with existing brush mask if present
  const existingMask = box.brushMask || [];
  const brushMask = [...existingMask, ...newStrokes];

  return {
    brushMask,
    analysis,
    hasChanges: newStrokes.length > 0
  };
}

/**
 * Debug visualization: Draw column density chart
 * @param {CanvasRenderingContext2D} ctx - Canvas context to draw on
 * @param {Object} analysis - Analysis result with debugData
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 */
export function drawDensityChart(ctx, analysis, width, height) {
  const { columnDensity, maxDensity, valleyThresholdAbsolute, leftMaskEnd, rightMaskStart } = analysis.debugData;

  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, width, height);

  // Draw density bars
  const barWidth = width / columnDensity.length;
  columnDensity.forEach((density, x) => {
    const barHeight = (density / maxDensity) * height;

    // Color based on whether it will be masked
    if ((leftMaskEnd !== null && x < leftMaskEnd) ||
        (rightMaskStart !== null && x >= rightMaskStart)) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // Red for masked
    } else {
      ctx.fillStyle = 'rgba(0, 100, 200, 0.5)'; // Blue for kept
    }

    ctx.fillRect(x * barWidth, height - barHeight, barWidth - 1, barHeight);
  });

  // Draw threshold line
  ctx.strokeStyle = 'orange';
  ctx.setLineDash([4, 4]);
  const thresholdY = height - (valleyThresholdAbsolute / maxDensity) * height;
  ctx.beginPath();
  ctx.moveTo(0, thresholdY);
  ctx.lineTo(width, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);
}
