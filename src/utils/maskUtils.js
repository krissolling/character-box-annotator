/**
 * Mask Utilities
 *
 * Standardized mask format (absolute image coordinates):
 * {
 *   pixels: Uint8Array,  // Single channel, 0 = keep, 255 = erase
 *   width: number,       // Mask dimensions
 *   height: number,
 *   offsetX: number,     // Absolute X position in image (where mask starts)
 *   offsetY: number      // Absolute Y position in image (where mask starts)
 * }
 *
 * Masks are stored in absolute image coordinates so they stay aligned with
 * the underlying image when boxes are resized. When boxes are moved, the
 * offsetX/offsetY are updated to keep the mask following the box.
 */

/**
 * Create an empty eraseMask
 * @param {number} width
 * @param {number} height
 * @param {number} offsetX - Absolute X position in image
 * @param {number} offsetY - Absolute Y position in image
 * @returns {Object} Empty eraseMask
 */
export function createEmptyMask(width, height, offsetX = 0, offsetY = 0) {
  return {
    pixels: new Uint8Array(width * height),
    width,
    height,
    offsetX,
    offsetY
  };
}

/**
 * Convert stroke array to eraseMask pixel data
 * @param {Array} strokes - Array of {points: [{x, y}...], size}
 * @param {number} width - Box width
 * @param {number} height - Box height
 * @param {number} boxX - Box X position (absolute image coordinates)
 * @param {number} boxY - Box Y position (absolute image coordinates)
 * @param {boolean} invert - If true, erase OUTSIDE strokes (for brush tool)
 * @returns {Object} eraseMask {pixels, width, height, offsetX, offsetY}
 */
export function strokesToEraseMask(strokes, width, height, boxX, boxY, invert = false) {
  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Start with transparent (or white if inverting)
  if (invert) {
    // For invert mode: start white (erase all), strokes will be black (keep)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'black';
  } else {
    // Normal mode: start transparent, strokes will be white (erase)
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
  }

  // Draw strokes
  strokes.forEach(stroke => {
    if (!stroke.points || stroke.points.length === 0) return;

    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw the stroke path
    ctx.beginPath();
    stroke.points.forEach((point, i) => {
      // Convert from absolute image coordinates to box-relative
      const x = point.x - boxX;
      const y = point.y - boxY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw circles at each point for proper round caps
    stroke.points.forEach(point => {
      const x = point.x - boxX;
      const y = point.y - boxY;
      ctx.beginPath();
      ctx.arc(x, y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // If invert mode and we have strokes, also fill the interior
  if (invert && strokes.length > 0) {
    ctx.fillStyle = 'black';
    ctx.beginPath();
    strokes.forEach(stroke => {
      if (stroke.points && stroke.points.length > 0) {
        const firstPoint = stroke.points[0];
        ctx.moveTo(firstPoint.x - boxX, firstPoint.y - boxY);
        stroke.points.slice(1).forEach(point => {
          ctx.lineTo(point.x - boxX, point.y - boxY);
        });
      }
    });
    ctx.closePath();
    ctx.fill('nonzero');
  }

  // Extract pixel data (single channel - just check red channel)
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = new Uint8Array(width * height);

  for (let i = 0; i < pixels.length; i++) {
    // White pixels (R=255) = erase, Black/transparent = keep
    pixels[i] = imageData.data[i * 4] > 127 ? 255 : 0;
  }

  return {
    pixels,
    width,
    height,
    offsetX: boxX,
    offsetY: boxY
  };
}

/**
 * Convert old brushMask format to eraseMask (with inversion)
 * Brush strokes define what to KEEP, so we invert to get what to ERASE
 * @param {Array} brushMask - Array of {points: [{x, y}...], size}
 * @param {number} boxWidth
 * @param {number} boxHeight
 * @param {number} boxX
 * @param {number} boxY
 * @returns {Object} eraseMask
 */
export function brushMaskToEraseMask(brushMask, boxWidth, boxHeight, boxX, boxY) {
  if (!brushMask || brushMask.length === 0) return null;
  return strokesToEraseMask(brushMask, boxWidth, boxHeight, boxX, boxY, true);
}

/**
 * Merge two eraseMasks (OR operation - if either says erase, erase)
 * Handles masks with different dimensions/positions by calculating bounding union
 * @param {Object} mask1 - First eraseMask (or null)
 * @param {Object} mask2 - Second eraseMask (or null)
 * @returns {Object} Merged eraseMask
 */
export function mergeEraseMasks(mask1, mask2) {
  if (!mask1) return mask2;
  if (!mask2) return mask1;

  const offsetX1 = mask1.offsetX !== undefined ? mask1.offsetX : 0;
  const offsetY1 = mask1.offsetY !== undefined ? mask1.offsetY : 0;
  const offsetX2 = mask2.offsetX !== undefined ? mask2.offsetX : 0;
  const offsetY2 = mask2.offsetY !== undefined ? mask2.offsetY : 0;

  // Calculate bounding box that contains both masks
  const minX = Math.min(offsetX1, offsetX2);
  const minY = Math.min(offsetY1, offsetY2);
  const maxX = Math.max(offsetX1 + mask1.width, offsetX2 + mask2.width);
  const maxY = Math.max(offsetY1 + mask1.height, offsetY2 + mask2.height);

  const mergedWidth = maxX - minX;
  const mergedHeight = maxY - minY;

  // Create merged mask covering the union of both masks
  const pixels = new Uint8Array(mergedWidth * mergedHeight);

  // Copy mask1 into merged mask
  for (let y = 0; y < mask1.height; y++) {
    for (let x = 0; x < mask1.width; x++) {
      const srcIdx = y * mask1.width + x;
      const dstX = (offsetX1 - minX) + x;
      const dstY = (offsetY1 - minY) + y;
      const dstIdx = dstY * mergedWidth + dstX;
      pixels[dstIdx] = mask1.pixels[srcIdx];
    }
  }

  // OR mask2 into merged mask
  for (let y = 0; y < mask2.height; y++) {
    for (let x = 0; x < mask2.width; x++) {
      const srcIdx = y * mask2.width + x;
      const dstX = (offsetX2 - minX) + x;
      const dstY = (offsetY2 - minY) + y;
      const dstIdx = dstY * mergedWidth + dstX;
      // OR operation: if either mask says erase, result is erase
      if (mask2.pixels[srcIdx] > 0) {
        pixels[dstIdx] = 255;
      }
    }
  }

  return {
    pixels,
    width: mergedWidth,
    height: mergedHeight,
    offsetX: minX,
    offsetY: minY
  };
}

/**
 * Translate eraseMask when box is moved
 * Updates offsetX and offsetY by the given deltas
 * @param {Object} mask - Original eraseMask
 * @param {number} deltaX - Change in X position
 * @param {number} deltaY - Change in Y position
 * @returns {Object} Translated eraseMask
 */
export function translateEraseMask(mask, deltaX, deltaY) {
  if (!mask) return null;
  if (deltaX === 0 && deltaY === 0) return mask;

  return {
    pixels: mask.pixels, // Pixel data unchanged
    width: mask.width,
    height: mask.height,
    offsetX: mask.offsetX + deltaX,
    offsetY: mask.offsetY + deltaY
  };
}

/**
 * DEPRECATED: Scale eraseMask when box is resized
 * NOTE: With absolute coordinates, we DON'T scale masks when boxes resize.
 * Masks stay at their original size and position to stay aligned with the image.
 * This function is kept for backward compatibility only.
 * @param {Object} mask - Original eraseMask
 * @param {number} newWidth
 * @param {number} newHeight
 * @returns {Object} Returns original mask unchanged
 */
export function scaleEraseMask(mask, newWidth, newHeight) {
  if (!mask) return null;
  // DO NOT SCALE - masks use absolute coordinates now
  console.warn('scaleEraseMask called but masks no longer scale with box resize');
  return mask;
}

/**
 * Convert eraseMask to RGBA ImageData for canvas rendering
 * @param {Object} eraseMask
 * @param {number} r - Red value for erase pixels (default 255)
 * @param {number} g - Green value (default 255)
 * @param {number} b - Blue value (default 255)
 * @returns {ImageData}
 */
export function eraseMaskToImageData(eraseMask, r = 255, g = 255, b = 255) {
  if (!eraseMask) return null;

  const { pixels, width, height } = eraseMask;
  const imageData = new ImageData(width, height);

  for (let i = 0; i < pixels.length; i++) {
    const idx = i * 4;
    if (pixels[i] > 0) {
      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255; // Fully opaque where erased
    }
    // else: leave as transparent (0, 0, 0, 0)
  }

  return imageData;
}

/**
 * Convert RGBA pixel array (from old eraseMaskData format) to single-channel eraseMask
 * @param {Array|Uint8ClampedArray} rgbaPixels - RGBA pixel array
 * @param {number} width
 * @param {number} height
 * @returns {Object} eraseMask
 */
export function rgbaToEraseMask(rgbaPixels, width, height) {
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    // Check alpha channel (index 3 of each pixel)
    pixels[i] = rgbaPixels[i * 4 + 3] > 127 ? 255 : 0;
  }
  return { pixels, width, height };
}

/**
 * Check if an eraseMask has any erased pixels
 * @param {Object} eraseMask
 * @returns {boolean}
 */
export function hasErasedPixels(eraseMask) {
  if (!eraseMask || !eraseMask.pixels) return false;
  for (let i = 0; i < eraseMask.pixels.length; i++) {
    if (eraseMask.pixels[i] > 0) return true;
  }
  return false;
}

/**
 * Serialize eraseMask for JSON storage
 * @param {Object} eraseMask
 * @returns {Object} Serializable object
 */
export function serializeEraseMask(eraseMask) {
  if (!eraseMask) return null;
  return {
    pixels: Array.from(eraseMask.pixels),
    width: eraseMask.width,
    height: eraseMask.height,
    offsetX: eraseMask.offsetX || 0,
    offsetY: eraseMask.offsetY || 0
  };
}

/**
 * Deserialize eraseMask from JSON storage
 * @param {Object} data - Serialized eraseMask
 * @returns {Object} eraseMask with Uint8Array pixels
 */
export function deserializeEraseMask(data) {
  if (!data) return null;
  return {
    pixels: new Uint8Array(data.pixels),
    width: data.width,
    height: data.height,
    offsetX: data.offsetX || 0,
    offsetY: data.offsetY || 0
  };
}
