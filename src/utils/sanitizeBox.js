/**
 * Sanitize Bounding Box - Auto-mask partial letters at edges
 *
 * Uses Connected Component Analysis to detect intruding partial letters
 * and generate shape-based masks (not just rectangular strips)
 */

/**
 * Convert RGB to grayscale using luminance formula
 */
function toGrayscale(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Detect if text is dark-on-light or light-on-dark
 * @param {ImageData} imageData
 * @returns {boolean} true if text appears darker than background
 */
function detectTextColor(imageData) {
  const { data, width, height } = imageData;

  // Check corners (assumed background) vs center (assumed text)
  const getGray = (x, y) => {
    const idx = (y * width + x) * 4;
    return toGrayscale(data[idx], data[idx + 1], data[idx + 2]);
  };

  const cornerAvg = (
    getGray(0, 0) +
    getGray(width - 1, 0) +
    getGray(0, height - 1) +
    getGray(width - 1, height - 1)
  ) / 4;

  // Sample center region
  let centerSum = 0;
  let centerCount = 0;
  const x1 = Math.floor(width / 3);
  const x2 = Math.floor(2 * width / 3);
  const y1 = Math.floor(height / 3);
  const y2 = Math.floor(2 * height / 3);

  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      centerSum += getGray(x, y);
      centerCount++;
    }
  }
  const centerAvg = centerSum / centerCount;

  return centerAvg < cornerAvg; // True if center (text) is darker
}

/**
 * Get binary image using Otsu's threshold
 * @param {Float32Array} grayData - Grayscale image data
 * @param {number} width
 * @param {number} height
 * @param {boolean} invert - If true, light pixels are foreground
 * @returns {Uint8Array} Binary image (0 or 1)
 */
function getBinary(grayData, width, height, invert = false) {
  // Calculate histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < grayData.length; i++) {
    histogram[Math.floor(grayData[i])]++;
  }

  // Otsu's threshold
  const total = grayData.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;

    const wF = total - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  // Apply threshold
  const binary = new Uint8Array(grayData.length);
  for (let i = 0; i < grayData.length; i++) {
    if (invert) {
      binary[i] = grayData[i] > threshold ? 1 : 0;
    } else {
      binary[i] = grayData[i] < threshold ? 1 : 0;
    }
  }

  return binary;
}

/**
 * Label connected components using flood fill
 * @param {Uint8Array} binary - Binary image
 * @param {number} width
 * @param {number} height
 * @returns {Object} { labeled: Int32Array, numLabels: number }
 */
function labelConnectedComponents(binary, width, height) {
  const labeled = new Int32Array(binary.length);
  let currentLabel = 0;

  const floodFill = (startX, startY, label) => {
    const stack = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (binary[idx] === 0 || labeled[idx] !== 0) continue;

      labeled[idx] = label;

      // 4-connectivity
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] === 1 && labeled[idx] === 0) {
        currentLabel++;
        floodFill(x, y, currentLabel);
      }
    }
  }

  return { labeled, numLabels: currentLabel };
}

/**
 * Apply morphological closing (dilation then erosion)
 * Simplified version - just use dilation for connecting nearby components
 */
function morphClose(binary, width, height, radius = 3) {
  const result = new Uint8Array(binary.length);

  // Dilation
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let found = false;
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (binary[ny * width + nx] === 1) {
                found = true;
              }
            }
          }
        }
      }
      result[y * width + x] = found ? 1 : 0;
    }
  }

  return result;
}

/**
 * Fill holes in binary image
 */
function fillHoles(binary, width, height) {
  const result = new Uint8Array(binary.length).fill(1);

  // Flood fill from edges to find background
  const stack = [];

  // Add all edge pixels that are background
  for (let x = 0; x < width; x++) {
    if (binary[x] === 0) stack.push([x, 0]);
    if (binary[(height - 1) * width + x] === 0) stack.push([x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    if (binary[y * width] === 0) stack.push([0, y]);
    if (binary[y * width + width - 1] === 0) stack.push([width - 1, y]);
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const idx = y * width + x;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (binary[idx] === 1 || result[idx] === 0) continue;

    result[idx] = 0; // Mark as background

    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  return result;
}

/**
 * Dilate a binary mask
 */
function dilateMask(mask, width, height, radius) {
  if (radius <= 0) return mask;

  const result = new Uint8Array(mask.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let found = false;
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (mask[ny * width + nx] === 1) {
                found = true;
              }
            }
          }
        }
      }
      result[y * width + x] = found ? 1 : 0;
    }
  }

  return result;
}

/**
 * Main analysis function using connected components
 * @param {HTMLImageElement} image - Source image
 * @param {Object} box - Box with x, y, width, height
 * @param {Object} options - Configuration options
 * @returns {Object} { intruderMask, hasIntruders, components, debugData }
 */
export function analyzeBoxForIntruders(image, box, options = {}) {
  const {
    dilationPercent = 2.5,  // Percentage of min dimension for dilation
    minAreaRatio = 0.0005,   // Minimum component area to consider
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
  const { data, width, height } = imageData;

  // Convert to grayscale
  const grayData = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    grayData[i] = toGrayscale(data[idx], data[idx + 1], data[idx + 2]);
  }

  // Detect text color and get binary
  const isDarkText = detectTextColor(imageData);
  const binary = getBinary(grayData, width, height, !isDarkText);

  // Morphological closing to connect nearby parts
  const binaryClosed = morphClose(binary, width, height, 3);

  // Fill holes (for letters with counters like 'o', 'a', 'e')
  const binaryFilled = fillHoles(binaryClosed, width, height);

  // Label connected components
  const { labeled, numLabels } = labelConnectedComponents(binaryFilled, width, height);

  // Analyze each component
  const totalArea = width * height;
  const centerX = width / 2;
  const centerY = height / 2;
  const components = [];

  for (let label = 1; label <= numLabels; label++) {
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let sumX = 0, sumY = 0, area = 0;

    // Find bounds and centroid
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (labeled[y * width + x] === label) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          sumX += x;
          sumY += y;
          area++;
        }
      }
    }

    if (area < totalArea * minAreaRatio) continue;

    const centroidX = sumX / area;
    const centroidY = sumY / area;
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;

    // Check edge touching
    const touchesLeft = minX <= 3;
    const touchesRight = maxX >= width - 4;
    const touchesTop = minY <= 3;
    const touchesBottom = maxY >= height - 4;

    // Check if cut off at edge
    const edgeMargin = 5;
    let cutOffLeft = false, cutOffRight = false, cutOffTop = false, cutOffBottom = false;

    if (touchesLeft) {
      let edgePixels = 0;
      for (let y = minY; y <= maxY; y++) {
        for (let x = 0; x < edgeMargin; x++) {
          if (binary[y * width + x] === 1) edgePixels++;
        }
      }
      cutOffLeft = edgePixels > bboxHeight * edgeMargin * 0.3;
    }

    if (touchesRight) {
      let edgePixels = 0;
      for (let y = minY; y <= maxY; y++) {
        for (let x = width - edgeMargin; x < width; x++) {
          if (binary[y * width + x] === 1) edgePixels++;
        }
      }
      cutOffRight = edgePixels > bboxHeight * edgeMargin * 0.3;
    }

    if (touchesTop) {
      let edgePixels = 0;
      for (let y = 0; y < edgeMargin; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (binary[y * width + x] === 1) edgePixels++;
        }
      }
      cutOffTop = edgePixels > bboxWidth * edgeMargin * 0.3;
    }

    if (touchesBottom) {
      let edgePixels = 0;
      for (let y = height - edgeMargin; y < height; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (binary[y * width + x] === 1) edgePixels++;
        }
      }
      cutOffBottom = edgePixels > bboxWidth * edgeMargin * 0.3;
    }

    const isCutOff = cutOffLeft || cutOffRight || cutOffTop || cutOffBottom;

    // Calculate score
    let score = 0;
    const distFromCenterX = Math.abs(centroidX - centerX) / (width / 2);
    const distFromCenterY = Math.abs(centroidY - centerY) / (height / 2);

    score += (1 - distFromCenterX) * 50;
    score += (1 - distFromCenterY) * 30;
    score += (area / totalArea) * 40;
    score += (bboxWidth / width) * 20;
    score += (bboxHeight / height) * 20;

    if (touchesLeft && !touchesRight) score -= 40;
    if (touchesRight && !touchesLeft) score -= 40;
    if (touchesTop && !touchesBottom) score -= 20;
    if (touchesBottom && !touchesTop) score -= 20;
    if (isCutOff) score -= 60;
    if (touchesLeft && touchesRight) score += 40;
    if (touchesTop && touchesBottom) score += 30;

    // Create mask for this component (using original binary, not filled)
    const componentMask = new Uint8Array(width * height);
    for (let i = 0; i < labeled.length; i++) {
      if (labeled[i] === label && binary[i] === 1) {
        componentMask[i] = 1;
      }
    }

    components.push({
      label,
      area,
      areaRatio: area / totalArea,
      centroid: { x: centroidX, y: centroidY },
      bbox: { minX, minY, maxX, maxY },
      touches: { left: touchesLeft, right: touchesRight, top: touchesTop, bottom: touchesBottom },
      cutOff: { left: cutOffLeft, right: cutOffRight, top: cutOffTop, bottom: cutOffBottom },
      isCutOff,
      score,
      mask: componentMask,
    });
  }

  if (components.length === 0) {
    return {
      intruderMask: null,
      hasIntruders: false,
      components: [],
      mainComponent: null,
      intruderComponents: [],
      debugData: { binary, width, height },
    };
  }

  // Sort by score to find main component
  components.sort((a, b) => b.score - a.score);
  const mainComponent = components[0];

  // Find intruders
  const intruderComponents = [];
  for (let i = 1; i < components.length; i++) {
    const comp = components[i];
    const touchesAnyEdge = comp.touches.left || comp.touches.right || comp.touches.top || comp.touches.bottom;

    if (touchesAnyEdge) {
      if (comp.isCutOff || comp.score < mainComponent.score * 0.5) {
        intruderComponents.push(comp);
      }
    }
  }

  // Combine intruder masks
  let intruderMask = null;
  if (intruderComponents.length > 0) {
    intruderMask = new Uint8Array(width * height);
    for (const comp of intruderComponents) {
      for (let i = 0; i < comp.mask.length; i++) {
        if (comp.mask[i] === 1) intruderMask[i] = 1;
      }
    }

    // Apply dilation
    const dilationPx = Math.round(Math.min(width, height) * dilationPercent / 100);
    if (dilationPx > 0) {
      intruderMask = dilateMask(intruderMask, width, height, dilationPx);
    }
  }

  return {
    intruderMask,
    hasIntruders: intruderComponents.length > 0,
    components,
    mainComponent,
    intruderComponents,
    debugData: {
      binary,
      binaryFilled,
      labeled,
      width,
      height,
      isDarkText,
      dilationPx: Math.round(Math.min(width, height) * dilationPercent / 100),
    },
  };
}

/**
 * Generate eraseMask from intruder mask (single-channel format)
 * @param {Uint8Array} intruderMask - Binary mask of intruders (0 or 1)
 * @param {number} width - Mask width
 * @param {number} height - Mask height
 * @param {number} offsetX - Absolute X position in image
 * @param {number} offsetY - Absolute Y position in image
 * @returns {Object} eraseMask {pixels: Uint8Array, width, height, offsetX, offsetY}
 */
export function generateEraseMask(intruderMask, width, height, offsetX = 0, offsetY = 0) {
  if (!intruderMask) return null;

  // Convert binary mask (0/1) to single-channel eraseMask (0/255)
  const pixels = new Uint8Array(width * height);

  for (let i = 0; i < intruderMask.length; i++) {
    pixels[i] = intruderMask[i] === 1 ? 255 : 0;
  }

  return { pixels, width, height, offsetX, offsetY };
}

/**
 * Main function: Sanitize a box by analyzing and generating mask
 * @param {HTMLImageElement} image - Source image
 * @param {Object} box - Box with x, y, width, height
 * @param {Object} options - Configuration options
 * @returns {Object} { eraseMask, analysis, hasChanges }
 */
export function sanitizeBox(image, box, options = {}) {
  const analysis = analyzeBoxForIntruders(image, box, options);

  if (!analysis.hasIntruders) {
    return {
      eraseMask: null,
      analysis,
      hasChanges: false,
    };
  }

  const eraseMask = generateEraseMask(
    analysis.intruderMask,
    analysis.debugData.width,
    analysis.debugData.height,
    box.x,  // offsetX = box's absolute position
    box.y   // offsetY = box's absolute position
  );

  console.log(`🎭 Created sanitize mask:`, {
    boxPosition: { x: box.x, y: box.y },
    boxSize: { w: box.width, h: box.height },
    maskPosition: { x: eraseMask.offsetX, y: eraseMask.offsetY },
    maskSize: { w: eraseMask.width, h: eraseMask.height }
  });

  return {
    eraseMask,
    analysis,
    hasChanges: eraseMask !== null,
  };
}

/**
 * Get intruder mask as ImageData for preview
 * @param {Object} analysis - Analysis result
 * @returns {ImageData|null}
 */
export function getIntruderMaskImageData(analysis) {
  if (!analysis.intruderMask) return null;

  const { width, height } = analysis.debugData;
  const imageData = new ImageData(width, height);

  for (let i = 0; i < analysis.intruderMask.length; i++) {
    const idx = i * 4;
    if (analysis.intruderMask[i] === 1) {
      imageData.data[idx] = 255;     // R
      imageData.data[idx + 1] = 50;  // G
      imageData.data[idx + 2] = 50;  // B
      imageData.data[idx + 3] = 180; // A
    }
  }

  return imageData;
}
