import RBush from 'rbush';

/**
 * Spatial index for efficient box queries using R-tree
 * Wraps rbush library with our box data structure
 */
export class SpatialIndex {
  constructor() {
    this.tree = new RBush();
    this.boxMap = new Map(); // Map box index to rbush item for fast removal
  }

  /**
   * Insert a box into the spatial index
   * @param {Object} box - Box data {x, y, width, height, charIndex, char}
   * @param {number} index - Box index in the boxes array
   */
  insert(box, index) {
    const item = {
      minX: box.x,
      minY: box.y,
      maxX: box.x + box.width,
      maxY: box.y + box.height,
      boxIndex: index,
      charIndex: box.charIndex,
      char: box.char
    };

    this.tree.insert(item);
    this.boxMap.set(index, item);
  }

  /**
   * Update a box in the spatial index
   * @param {Object} box - Updated box data
   * @param {number} index - Box index
   */
  update(box, index) {
    this.remove(index);
    this.insert(box, index);
  }

  /**
   * Remove a box from the spatial index
   * @param {number} index - Box index to remove
   */
  remove(index) {
    const item = this.boxMap.get(index);
    if (item) {
      this.tree.remove(item);
      this.boxMap.delete(index);
    }
  }

  /**
   * Search for boxes within a bounding box
   * @param {Object} bounds - Search bounds {x, y, width, height}
   * @returns {Array} Array of box items
   */
  search(bounds) {
    return this.tree.search({
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height
    });
  }

  /**
   * Find the topmost box at a point (for hover/click detection)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} tolerance - Search tolerance in image pixels (includes corner/edge hitboxes)
   * @returns {Object|null} Box item or null
   */
  findBoxAtPoint(x, y, tolerance = 0) {
    const results = this.tree.search({
      minX: x - tolerance,
      minY: y - tolerance,
      maxX: x + tolerance,
      maxY: y + tolerance
    });

    // Return the last item (topmost in render order)
    return results.length > 0 ? results[results.length - 1] : null;
  }

  /**
   * Find all boxes that intersect with a point
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Array} Array of box items
   */
  findBoxesAtPoint(x, y) {
    return this.tree.search({
      minX: x,
      minY: y,
      maxX: x,
      maxY: y
    });
  }

  /**
   * Check if a point is inside a box (considering corners and edges)
   * @param {Object} box - Box from rbush {minX, minY, maxX, maxY}
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} Hit test result {type: 'corner'|'edge'|'inside', corner: 'nw'|'ne'|'sw'|'se', edge: 'n'|'s'|'e'|'w'}
   */
  hitTest(box, x, y, handleSize = 20) {
    const corners = [
      { name: 'nw', x: box.minX, y: box.minY },
      { name: 'ne', x: box.maxX, y: box.minY },
      { name: 'sw', x: box.minX, y: box.maxY },
      { name: 'se', x: box.maxX, y: box.maxY }
    ];

    // Check corners first
    for (const corner of corners) {
      if (Math.abs(x - corner.x) < handleSize && Math.abs(y - corner.y) < handleSize) {
        return { type: 'corner', corner: corner.name };
      }
    }

    // Check edges
    const edgeThreshold = 10;
    const inXRange = x >= box.minX && x <= box.maxX;
    const inYRange = y >= box.minY && y <= box.maxY;

    if (inXRange && Math.abs(y - box.minY) < edgeThreshold) {
      return { type: 'edge', edge: 'n' };
    }
    if (inXRange && Math.abs(y - box.maxY) < edgeThreshold) {
      return { type: 'edge', edge: 's' };
    }
    if (inYRange && Math.abs(x - box.minX) < edgeThreshold) {
      return { type: 'edge', edge: 'w' };
    }
    if (inYRange && Math.abs(x - box.maxX) < edgeThreshold) {
      return { type: 'edge', edge: 'e' };
    }

    // Check if inside
    if (inXRange && inYRange) {
      return { type: 'inside' };
    }

    return null;
  }

  /**
   * Get total number of boxes in index
   * @returns {number} Box count
   */
  size() {
    return this.boxMap.size;
  }

  /**
   * Clear all boxes from index
   */
  clear() {
    this.tree.clear();
    this.boxMap.clear();
  }

  /**
   * Rebuild the entire index from a boxes array
   * @param {Array} boxes - Array of boxes to index
   */
  rebuild(boxes) {
    this.clear();
    boxes.forEach((box, index) => {
      this.insert(box, index);
    });
  }
}
