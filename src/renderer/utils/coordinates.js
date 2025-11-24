/**
 * Coordinate transformation utilities for pixi.js rendering
 */

/**
 * Convert screen coordinates to image coordinates
 * @param {number} screenX - Screen X coordinate
 * @param {number} screenY - Screen Y coordinate
 * @param {PIXI.Container} stage - The pixi.js stage
 * @returns {{x: number, y: number}} Image coordinates
 */
export function screenToImage(screenX, screenY, stage) {
  return {
    x: (screenX - stage.position.x) / stage.scale.x,
    y: (screenY - stage.position.y) / stage.scale.y
  };
}

/**
 * Convert image coordinates to screen coordinates
 * @param {number} imageX - Image X coordinate
 * @param {number} imageY - Image Y coordinate
 * @param {PIXI.Container} stage - The pixi.js stage
 * @returns {{x: number, y: number}} Screen coordinates
 */
export function imageToScreen(imageX, imageY, stage) {
  return {
    x: imageX * stage.scale.x + stage.position.x,
    y: imageY * stage.scale.y + stage.position.y
  };
}

/**
 * Get viewport bounds in image coordinates
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {number} canvasHeight - Canvas height in pixels
 * @param {PIXI.Container} stage - The pixi.js stage
 * @returns {{x: number, y: number, width: number, height: number}} Viewport bounds
 */
export function getViewportBounds(canvasWidth, canvasHeight, stage) {
  const topLeft = screenToImage(0, 0, stage);
  const bottomRight = screenToImage(canvasWidth, canvasHeight, stage);

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y
  };
}

/**
 * Check if a rectangle intersects the viewport
 * @param {Object} rect - Rectangle to check {x, y, width, height}
 * @param {Object} viewport - Viewport bounds {x, y, width, height}
 * @returns {boolean} True if rectangles intersect
 */
export function intersectsViewport(rect, viewport) {
  return !(
    rect.x + rect.width < viewport.x ||
    rect.x > viewport.x + viewport.width ||
    rect.y + rect.height < viewport.y ||
    rect.y > viewport.y + viewport.height
  );
}

/**
 * Calculate the appropriate LOD (Level of Detail) based on zoom level
 * @param {number} zoomLevel - Current zoom level
 * @param {number} maxLevels - Maximum number of LOD levels
 * @returns {number} LOD level (0 = full res, higher = lower res)
 */
export function calculateLOD(zoomLevel, maxLevels = 4) {
  // At zoom 1.0, use full resolution (level 0)
  // At zoom 0.5, use level 1 (50% res)
  // At zoom 0.25, use level 2 (25% res)
  // etc.

  if (zoomLevel >= 1.0) return 0;

  const level = Math.floor(-Math.log2(zoomLevel));
  return Math.min(level, maxLevels - 1);
}

/**
 * Expand bounds by a margin (for preloading adjacent tiles)
 * @param {Object} bounds - Original bounds {x, y, width, height}
 * @param {number} margin - Margin in image pixels
 * @returns {Object} Expanded bounds
 */
export function expandBounds(bounds, margin) {
  return {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2
  };
}
